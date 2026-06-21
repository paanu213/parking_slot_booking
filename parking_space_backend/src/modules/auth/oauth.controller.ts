import type { Request, RequestHandler, Response } from 'express';
import { BadRequest, ServerError } from '../../lib/http.js';
import { issueTokens } from './auth.service.js';
import { setAuthCookies } from './auth.controller.js';
import * as service from './oauth.service.js';
import type { OAuthProfile, OAuthState } from './oauth.service.js';

/** Turn a verified provider profile into a session + redirect back to the SPA. */
const completeLogin = async (req: Request, res: Response, profile: OAuthProfile) => {
  const { portal, origin, returnTo } = service.decodeState(req.query.state as string | undefined);
  const base = service.resolveBase(portal, origin);
  const redirect = (path: string) => res.redirect(service.buildRedirect(base, path));

  // The state cookie has done its CSRF job — clear it once here.
  res.clearCookie(service.STATE_COOKIE, { ...service.stateCookieOptions(), maxAge: undefined });

  const result = await service.resolveOAuthLogin(portal, profile);
  if (result.status === 'error') return redirect(result.path);

  const { accessToken, refreshToken } = await issueTokens(result.user);
  setAuthCookies(res, accessToken, refreshToken);
  return redirect(returnTo);
};

/** Start an OAuth flow: stash the CSRF state in a cookie, redirect to the provider. */
const startFlow = (buildUrl: (s: OAuthState) => string): RequestHandler =>
  (req, res, next) => {
    try {
      const csrf = service.buildState();
      const state: OAuthState = {
        csrf,
        portal:   service.portalFromQuery(req.query.portal),
        origin:   service.safeOriginOrEmpty(req.query.origin ?? req.headers.referer),
        returnTo: service.sanitizeReturnTo(req.query.returnTo),
      };
      res.cookie(service.STATE_COOKIE, csrf, service.stateCookieOptions());
      res.redirect(buildUrl(state));
    } catch (e) {
      next(e);
    }
  };

export const googleStart = startFlow(service.buildGoogleAuthUrl);
export const facebookStart = startFlow(service.buildFacebookAuthUrl);

export const googleCallback: RequestHandler = async (req, res, next) => {
  try {
    service.verifyState(req.query.state as string | undefined, req.cookies?.[service.STATE_COOKIE]);
    const code = req.query.code as string | undefined;
    if (!code) throw BadRequest('Missing code');
    await completeLogin(req, res, await service.exchangeGoogle(code));
  } catch (e) {
    next(e);
  }
};

export const facebookCallback: RequestHandler = async (req, res, next) => {
  try {
    service.verifyState(req.query.state as string | undefined, req.cookies?.[service.STATE_COOKIE]);
    const code = req.query.code as string | undefined;
    if (!code) throw BadRequest('Missing code');
    await completeLogin(req, res, await service.exchangeFacebook(code));
  } catch (e) {
    next(e);
  }
};

export const appleStart: RequestHandler = (_req, _res, next) => {
  next(ServerError('Apple OAuth not yet configured — wire APPLE_* env vars and a signed client_secret JWT'));
};
