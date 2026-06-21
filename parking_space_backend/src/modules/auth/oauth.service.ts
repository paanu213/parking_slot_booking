/**
 * OAuth service — provider token exchange, CSRF-state encoding, safe redirect
 * resolution, and the user lookup/provision + role-gating decision.
 *
 * No HTTP concerns here (cookies/redirects live in the controller); this layer
 * is the testable logic of the social-login flow.
 */
import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { env, corsOrigins } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, ServerError } from '../../lib/http.js';
import { claimDirectBookings } from '../bookings/bookings.service.js';

export const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

export type Portal = 'customer' | 'vendor' | 'admin';
const PORTALS: readonly Portal[] = ['customer', 'vendor', 'admin'] as const;
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN']);

export interface OAuthProfile {
  provider: 'GOOGLE' | 'FACEBOOK' | 'APPLE';
  providerId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export interface OAuthState {
  csrf: string;
  portal: Portal;
  origin: string;
  returnTo: string;
}

export const portalFromQuery = (raw: unknown): Portal => {
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

export const buildState = () => crypto.randomBytes(16).toString('hex');

export const stateCookieOptions = () =>
  ({
    httpOnly: true,
    secure:   env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    domain:   env.COOKIE_DOMAIN,
    path:     '/api/auth',
    maxAge:   STATE_TTL_MS,
  });

/**
 * Round-trip four values through the OAuth `state` param (origin has no `|`,
 * returnTo is reconstructed from everything after the 3rd `|` so it may):
 *   csrf | portal | origin | returnTo
 */
export const encodeState = (csrf: string, portal: Portal, origin: string, returnTo: string) =>
  `${csrf}|${portal}|${origin}|${returnTo}`;

export const decodeState = (state: string | undefined): OAuthState => {
  if (!state) return { csrf: '', portal: 'customer', origin: '', returnTo: '/' };
  const parts = state.split('|');
  const portalRaw = parts[1] ?? 'customer';
  return {
    csrf:     parts[0] ?? '',
    portal:   (PORTALS as readonly string[]).includes(portalRaw) ? (portalRaw as Portal) : 'customer',
    origin:   parts[2] ?? '',
    returnTo: parts.slice(3).join('|') || '/',
  };
};

/**
 * Only accept an origin we already trust (it's in CORS_ORIGINS). Accepts a bare
 * origin or a full URL (e.g. a Referer header) — extracting just the origin.
 */
export const safeOriginOrEmpty = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '';
  let origin = value.replace(/\/$/, '');
  if (origin.includes('/', 'https://'.length)) {
    try {
      origin = new URL(value).origin;
    } catch {
      return '';
    }
  }
  return corsOrigins.includes(origin) ? origin : '';
};

/** Prefer the SPA's own validated origin; fall back to the configured FRONTEND_*_URL. */
export const resolveBase = (portal: Portal, origin: string): string => {
  const validated = safeOriginOrEmpty(origin);
  if (validated) return validated;
  return frontendBase(portal).replace(/\/$/, '');
};

/**
 * Sanitize a post-login `returnTo` into a safe **relative** path. Rejects absolute
 * URLs, protocol-relative `//host`, backslash tricks and CR/LF (open-redirect defence).
 */
export const sanitizeReturnTo = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw) return '/';
  const v = raw.replace(/[\r\n\t]/g, '');
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return '/';
  return v;
};

/** Build an absolute redirect URL on `base`'s origin (defends against open-redirect). */
export const buildRedirect = (base: string, pathOrQuery: string): string => {
  const safe = '/' + sanitizeReturnTo(pathOrQuery).replace(/^\/+/, '');
  return `${base}${safe}`;
};

/** Verify the `state` CSRF token matches the short-lived httpOnly cookie. */
export const verifyState = (state: string | undefined, storedCookie: string | undefined) => {
  const { csrf } = decodeState(state);
  if (!csrf || !storedCookie || csrf !== storedCookie) throw BadRequest('Invalid OAuth state');
};

// ── Provider redirect URLs ──────────────────────────────────────────────────
export const buildGoogleAuthUrl = (s: OAuthState): string => {
  if (!env.GOOGLE_CLIENT_ID) throw ServerError('Google OAuth not configured');
  const params = new URLSearchParams({
    client_id:     env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${env.API_BASE_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope:         'openid email profile',
    state:         encodeState(s.csrf, s.portal, s.origin, s.returnTo),
    access_type:   'offline',
    prompt:        'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const buildFacebookAuthUrl = (s: OAuthState): string => {
  if (!env.FACEBOOK_APP_ID) throw ServerError('Facebook OAuth not configured');
  const params = new URLSearchParams({
    client_id:     env.FACEBOOK_APP_ID,
    redirect_uri:  `${env.API_BASE_URL}/api/auth/facebook/callback`,
    response_type: 'code',
    scope:         'email public_profile',
    state:         encodeState(s.csrf, s.portal, s.origin, s.returnTo),
  });
  return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
};

// ── Provider token exchange + profile fetch ─────────────────────────────────
export const exchangeGoogle = async (code: string): Promise<OAuthProfile> => {
  if (!env.GOOGLE_CLIENT_ID) throw ServerError('Google OAuth not configured');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri:  `${env.API_BASE_URL}/api/auth/google/callback`,
      grant_type:    'authorization_code',
    }),
  }).then((res) => res.json() as Promise<{ access_token?: string; id_token?: string }>);
  if (!tokenRes.access_token) throw BadRequest('Token exchange failed');

  const profile = (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenRes.access_token}` },
  }).then((res) => res.json())) as { sub: string; email: string; name: string; picture?: string };

  return {
    provider:   'GOOGLE',
    providerId: profile.sub,
    email:      profile.email,
    fullName:   profile.name,
    avatarUrl:  profile.picture,
  };
};

export const exchangeFacebook = async (code: string): Promise<OAuthProfile> => {
  if (!env.FACEBOOK_APP_ID) throw ServerError('Facebook OAuth not configured');
  const tokenRes = (await fetch(
    `https://graph.facebook.com/v20.0/oauth/access_token?${new URLSearchParams({
      client_id:     env.FACEBOOK_APP_ID ?? '',
      client_secret: env.FACEBOOK_APP_SECRET ?? '',
      redirect_uri:  `${env.API_BASE_URL}/api/auth/facebook/callback`,
      code,
    }).toString()}`,
  ).then((res) => res.json())) as { access_token?: string };
  if (!tokenRes.access_token) throw BadRequest('Token exchange failed');

  const profile = (await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokenRes.access_token}`,
  ).then((res) => res.json())) as { id: string; name: string; email?: string; picture?: { data?: { url?: string } } };

  if (!profile.email) throw BadRequest('Email permission required');
  return {
    provider:   'FACEBOOK',
    providerId: profile.id,
    email:      profile.email,
    fullName:   profile.name,
    avatarUrl:  profile.picture?.data?.url,
  };
};

// ── User lookup / provision + role gating ───────────────────────────────────
export type OAuthLoginResult =
  | { status: 'error'; path: string }
  | { status: 'ok'; user: User };

export const resolveOAuthLogin = async (
  portal: Portal,
  profile: OAuthProfile,
): Promise<OAuthLoginResult> => {
  // Look up by provider identity first, then fall back to email.
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { provider: profile.provider, providerId: profile.providerId },
        { email: profile.email },
      ],
    },
  });

  // Role-gated portals (admin, vendor) must NOT auto-provision via SSO.
  if (portal === 'admin' || portal === 'vendor') {
    if (!user) return { status: 'error', path: '/login?error=not_registered' };
    const roleOk = portal === 'admin' ? ADMIN_ROLES.has(user.role) : user.role === 'VENDOR';
    if (!roleOk) return { status: 'error', path: '/login?error=wrong_portal' };
    if (user.status !== 'ACTIVE') return { status: 'error', path: '/login?error=inactive' };
    return { status: 'ok', user };
  }

  // Customer portal — auto-create on first sign-in.
  if (!user) {
    // Most User string columns are VARCHAR(191); Google picture URLs can exceed
    // that and blow up the INSERT, so guard the length.
    const safeAvatarUrl =
      profile.avatarUrl && profile.avatarUrl.length <= 190 ? profile.avatarUrl : null;
    user = await prisma.user.create({
      data: {
        email:         profile.email,
        fullName:      profile.fullName.slice(0, 190),
        provider:      profile.provider,
        providerId:    profile.providerId,
        emailVerified: true,
        avatarUrl:     safeAvatarUrl,
        role:          'CUSTOMER',
      },
    });
  } else if (user.provider === 'EMAIL') {
    user = await prisma.user.update({
      where: { id: user.id },
      data:  { provider: profile.provider, providerId: profile.providerId, emailVerified: true },
    });
  }

  // Attach any walk-in bookings a vendor created for this email.
  await claimDirectBookings(user.id, user.email).catch(() => {});

  return { status: 'ok', user };
};
