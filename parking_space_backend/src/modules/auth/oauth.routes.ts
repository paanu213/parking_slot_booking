import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { issueTokens } from './auth.service.js';
import { setAuthCookies } from './auth.controller.js';
import { BadRequest, ServerError } from '../../lib/http.js';

const r = Router();

const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

const buildState = () => crypto.randomBytes(16).toString('hex');

const stateCookieOptions = () =>
  ({
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    domain: env.COOKIE_DOMAIN,
    path: '/api/auth',
    maxAge: STATE_TTL_MS,
  });

/** Combine a CSRF token with the post-login returnTo so we round-trip it via the state param. */
const encodeState = (csrf: string, returnTo: string) => `${csrf}|${returnTo}`;
const decodeState = (state: string | undefined) => {
  if (!state) return { csrf: '', returnTo: '/' };
  const [csrf = '', returnTo = '/'] = state.split('|');
  return { csrf, returnTo };
};

const finishOAuthLogin = async (
  req: Request,
  res: Response,
  profile: {
    provider: 'GOOGLE' | 'FACEBOOK' | 'APPLE';
    providerId: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
  },
) => {
  let user = await prisma.user.findFirst({
    where: { OR: [{ provider: profile.provider, providerId: profile.providerId }, { email: profile.email }] },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        fullName: profile.fullName,
        provider: profile.provider,
        providerId: profile.providerId,
        emailVerified: true,
        avatarUrl: profile.avatarUrl,
        role: 'CUSTOMER',
      },
    });
  } else if (user.provider === 'EMAIL') {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { provider: profile.provider, providerId: profile.providerId, emailVerified: true },
    });
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  setAuthCookies(res, accessToken, refreshToken);

  const { returnTo } = decodeState(req.query.state as string | undefined);
  res.clearCookie(STATE_COOKIE, { ...stateCookieOptions(), maxAge: undefined });
  // Only allow same-origin returnTo paths.
  const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
  res.redirect(safeReturn);
};

/**
 * Verify that the `state` query value matches the CSRF token we stored
 * in a short-lived httpOnly cookie when initiating the redirect.
 */
const assertState = (req: Request) => {
  const { csrf } = decodeState(req.query.state as string | undefined);
  const stored = req.cookies?.[STATE_COOKIE] as string | undefined;
  if (!csrf || !stored || csrf !== stored) throw BadRequest('Invalid OAuth state');
};

// ---------- Google ----------
r.get('/google', (req, res, next) => {
  if (!env.GOOGLE_CLIENT_ID) return next(ServerError('Google OAuth not configured'));
  const csrf = buildState();
  const returnTo = (req.query.returnTo as string) ?? '/';
  res.cookie(STATE_COOKIE, csrf, stateCookieOptions());
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.API_BASE_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state: encodeState(csrf, returnTo),
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

r.get('/google/callback', async (req, res, next) => {
  try {
    assertState(req);
    const code = req.query.code as string | undefined;
    if (!code) throw BadRequest('Missing code');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID ?? '',
        client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: `${env.API_BASE_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    }).then((r) => r.json() as Promise<{ access_token?: string; id_token?: string }>);
    if (!tokenRes.access_token) throw BadRequest('Token exchange failed');

    const profile = (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` },
    }).then((r) => r.json())) as { sub: string; email: string; name: string; picture?: string };

    await finishOAuthLogin(req, res, {
      provider: 'GOOGLE',
      providerId: profile.sub,
      email: profile.email,
      fullName: profile.name,
      avatarUrl: profile.picture,
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Facebook ----------
r.get('/facebook', (req, res, next) => {
  if (!env.FACEBOOK_APP_ID) return next(ServerError('Facebook OAuth not configured'));
  const csrf = buildState();
  const returnTo = (req.query.returnTo as string) ?? '/';
  res.cookie(STATE_COOKIE, csrf, stateCookieOptions());
  const params = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID,
    redirect_uri: `${env.API_BASE_URL}/api/auth/facebook/callback`,
    response_type: 'code',
    scope: 'email public_profile',
    state: encodeState(csrf, returnTo),
  });
  res.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`);
});

r.get('/facebook/callback', async (req, res, next) => {
  try {
    assertState(req);
    const code = req.query.code as string | undefined;
    if (!code) throw BadRequest('Missing code');
    const tokenRes = (await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?${new URLSearchParams({
        client_id: env.FACEBOOK_APP_ID ?? '',
        client_secret: env.FACEBOOK_APP_SECRET ?? '',
        redirect_uri: `${env.API_BASE_URL}/api/auth/facebook/callback`,
        code,
      }).toString()}`,
    ).then((r) => r.json())) as { access_token?: string };
    if (!tokenRes.access_token) throw BadRequest('Token exchange failed');

    const profile = (await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokenRes.access_token}`,
    ).then((r) => r.json())) as { id: string; name: string; email?: string; picture?: { data?: { url?: string } } };

    if (!profile.email) throw BadRequest('Email permission required');
    await finishOAuthLogin(req, res, {
      provider: 'FACEBOOK',
      providerId: profile.id,
      email: profile.email,
      fullName: profile.name,
      avatarUrl: profile.picture?.data?.url,
    });
  } catch (e) {
    next(e);
  }
});

// ---------- Apple (stubbed — requires JWT client secret) ----------
r.get('/apple', (_req, _res, next) => {
  next(ServerError('Apple OAuth not yet configured — wire APPLE_* env vars and a signed client_secret JWT'));
});

export default r;
