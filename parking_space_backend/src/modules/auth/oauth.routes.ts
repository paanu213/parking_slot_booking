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

type Portal = 'customer' | 'vendor' | 'admin';
const PORTALS: readonly Portal[] = ['customer', 'vendor', 'admin'] as const;
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN']);

const portalFromQuery = (raw: unknown): Portal => {
  const s = typeof raw === 'string' ? raw.toLowerCase() : '';
  return (PORTALS as readonly string[]).includes(s) ? (s as Portal) : 'customer';
};

const frontendBase = (portal: Portal): string => {
  switch (portal) {
    case 'admin':  return env.FRONTEND_ADMIN_URL;
    case 'vendor': return env.FRONTEND_VENDOR_URL;
    default:       return env.FRONTEND_CUSTOMER_URL;
  }
};

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

/**
 * Round-trip three values through the OAuth state param:
 *   csrf  — random token also stored in a httpOnly cookie for verification.
 *   portal — which SPA initiated the flow (admin/vendor/customer).
 *   returnTo — relative path inside that SPA to land on after login.
 */
const encodeState = (csrf: string, portal: Portal, returnTo: string) =>
  `${csrf}|${portal}|${returnTo}`;

const decodeState = (state: string | undefined) => {
  if (!state) return { csrf: '', portal: 'customer' as Portal, returnTo: '/' };
  const [csrf = '', portalRaw = 'customer', returnTo = '/'] = state.split('|');
  const portal: Portal = (PORTALS as readonly string[]).includes(portalRaw)
    ? (portalRaw as Portal)
    : 'customer';
  return { csrf, portal, returnTo };
};

/** Build an absolute URL inside the portal's SPA, defending against open-redirect. */
const portalRedirect = (
  portal: Portal,
  pathOrQuery: string,
): string => {
  const base = frontendBase(portal).replace(/\/$/, '');
  const safe = pathOrQuery.startsWith('/') ? pathOrQuery : `/${pathOrQuery}`;
  return `${base}${safe}`;
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
  const { portal, returnTo } = decodeState(req.query.state as string | undefined);

  // Always look up by provider identity first, then fall back to email.
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { provider: profile.provider, providerId: profile.providerId },
        { email: profile.email },
      ],
    },
  });

  // Role-gated portals (admin, vendor) must NOT auto-provision accounts via SSO.
  // The user has to already exist with the correct role.
  if (portal === 'admin' || portal === 'vendor') {
    res.clearCookie(STATE_COOKIE, { ...stateCookieOptions(), maxAge: undefined });
    if (!user) {
      return res.redirect(portalRedirect(portal, '/login?error=not_registered'));
    }
    const roleOk =
      portal === 'admin'
        ? ADMIN_ROLES.has(user.role)
        : user.role === 'VENDOR';
    if (!roleOk) {
      return res.redirect(portalRedirect(portal, '/login?error=wrong_portal'));
    }
    if (user.status !== 'ACTIVE') {
      return res.redirect(portalRedirect(portal, '/login?error=inactive'));
    }
    const { accessToken, refreshToken } = await issueTokens(user);
    setAuthCookies(res, accessToken, refreshToken);
    return res.redirect(portalRedirect(portal, returnTo));
  }

  // Customer portal — auto-create on first sign-in.
  if (!user) {
    // Most User string columns are VARCHAR(191) in MySQL; Google profile
    // picture URLs can exceed that and blow up the INSERT, so guard the length.
    const safeAvatarUrl =
      profile.avatarUrl && profile.avatarUrl.length <= 190 ? profile.avatarUrl : null;
    user = await prisma.user.create({
      data: {
        email: profile.email,
        fullName: profile.fullName.slice(0, 190),
        provider: profile.provider,
        providerId: profile.providerId,
        emailVerified: true,
        avatarUrl: safeAvatarUrl,
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
  res.clearCookie(STATE_COOKIE, { ...stateCookieOptions(), maxAge: undefined });
  return res.redirect(portalRedirect('customer', returnTo));
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
  const portal = portalFromQuery(req.query.portal);
  const rawReturn = (req.query.returnTo as string) ?? '/';
  // returnTo is appended to the portal's frontend base URL; restrict to relative paths only.
  const returnTo = rawReturn.startsWith('/') ? rawReturn : '/';
  res.cookie(STATE_COOKIE, csrf, stateCookieOptions());
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.API_BASE_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state: encodeState(csrf, portal, returnTo),
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
  const portal = portalFromQuery(req.query.portal);
  const rawReturn = (req.query.returnTo as string) ?? '/';
  const returnTo = rawReturn.startsWith('/') ? rawReturn : '/';
  res.cookie(STATE_COOKIE, csrf, stateCookieOptions());
  const params = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID,
    redirect_uri: `${env.API_BASE_URL}/api/auth/facebook/callback`,
    response_type: 'code',
    scope: 'email public_profile',
    state: encodeState(csrf, portal, returnTo),
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
