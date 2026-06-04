/**
 * Centralised runtime config. Read from Vite env vars with sensible defaults
 * so a missing `.env` doesn't take the app down in development.
 *
 * - `VITE_API_URL`     — backend base URL (e.g. http://localhost:4000/api)
 * - `VITE_VENDOR_URL`  — vendor (partner) portal URL
 */

const env = import.meta.env;

export const API_URL = (env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

export const VENDOR_URL = (env.VITE_VENDOR_URL as string | undefined) ?? 'http://localhost:5174';

/** Brand identity — keep both in sync. The logo is served from Cloudflare R2. */
export const BRAND_NAME = 'AutoSahay';
export const LOGO_URL =
  'https://pub-35c378c6c1af4543b728eae61d1261d7.r2.dev/2026/05/App_images/AUTOSAHAY%20png.png';

/**
 * Customer-support contact details, surfaced wherever the customer needs to
 * reach us (footer, help links, error fallbacks, etc.). One source of truth
 * so a future change is a one-line edit.
 */
export const SUPPORT_EMAIL = 'autosahay@gmail.com';
/** Digits only — used in `tel:` URLs. */
export const SUPPORT_PHONE = '8328352730';
/** Human-formatted version used in visible text. */
export const SUPPORT_PHONE_DISPLAY = '83283 52730';

/** Pricing constants used across the booking + checkout flows. */
export const PRICING = {
  PLATFORM_FEE_PCT: 5,
  GST_PCT: 18,
} as const;
