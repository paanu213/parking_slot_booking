/**
 * Social-login routes (Google, Facebook; Apple stubbed). Each provider has a
 * start endpoint (→ provider consent screen) and a callback (→ session + SPA).
 */
import { Router } from 'express';
import * as ctrl from './oauth.controller.js';

const r = Router();

// Google
r.get('/google', ctrl.googleStart);
r.get('/google/callback', ctrl.googleCallback);

// Facebook
r.get('/facebook', ctrl.facebookStart);
r.get('/facebook/callback', ctrl.facebookCallback);

// Apple (stubbed)
r.get('/apple', ctrl.appleStart);

export default r;
