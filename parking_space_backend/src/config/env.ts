import 'dotenv/config';
import { z } from 'zod';

// "false" / "0" / "" / "no" / "off" -> false; anything else truthy -> true.
// (z.coerce.boolean() is unsafe here because Boolean("false") === true.)
const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    return !['false', '0', '', 'no', 'off'].includes(v.trim().toLowerCase());
  });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default(''),

  // Absolute URLs for each frontend SPA — used for OAuth post-login redirects.
  // Must include scheme + host + port (no trailing slash). Defaults are dev ports.
  FRONTEND_CUSTOMER_URL: z.string().url().default('http://localhost:5173'),
  FRONTEND_VENDOR_URL:   z.string().url().default('http://localhost:5174'),
  FRONTEND_ADMIN_URL:    z.string().url().default('http://localhost:5175'),

  DATABASE_URL: z.string().min(1),
  // Direct mysql:// connection for migrations (Accelerate prisma:// can't run DDL).
  // Optional so local dev can run on DATABASE_URL alone.
  DIRECT_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // AES-256-GCM key for QR Calling PII (plate/phone/medical notes) + keyed
  // lookup hashes — 64 hex chars (32 bytes). Generate with `openssl rand -hex 32`.
  QR_DATA_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'QR_DATA_KEY must be a 64-character hex string (openssl rand -hex 32)'),

  // QR Calling telephony — swappable adapter (lib/callProviders). 'exotel' is
  // the only real provider wired up today; there is no demo/simulated
  // fallback — getProvider()/the adapter itself throws a clear error if it
  // isn't configured, rather than silently faking a call.
  CALL_PROVIDER: z.string().default('exotel'),
  // Platform-wide cost guard — total calls/day across all cars, independent
  // of the per-registration/per-caller/per-IP limits below it in calls.service.
  CALL_GLOBAL_DAILY_CAP: z.coerce.number().int().positive().default(2000),

  // Exotel — Voice API "Connect two numbers" (lib/callProviders/exotel.ts).
  // Optional at the schema level (only needed when CALL_PROVIDER=exotel); the
  // production check below requires all of them together once that's the case.
  EXOTEL_API_KEY: z.string().optional(),
  EXOTEL_API_TOKEN: z.string().optional(),
  EXOTEL_ACCOUNT_SID: z.string().optional(),
  // Region subdomain — 'api.in.exotel.com' (Mumbai) covers Indian ExoPhones.
  EXOTEL_SUBDOMAIN: z.string().default('api.in.exotel.com'),
  // The ExoPhone(s) calls go out from — provisioned in the Exotel dashboard,
  // not something we can invent at runtime like the mock does. Comma-separated
  // — when more than one is set, calls.service tries them in order and falls
  // back to the next if one fails to place the call.
  EXOTEL_VIRTUAL_NUMBERS: z.string().optional(),
  // Exotel's StatusCallback has no signature/HMAC mechanism (confirmed against
  // their docs) — this shared secret rides as a query param on the callback
  // URL we hand Exotel, and is checked before trusting any webhook body.
  EXOTEL_WEBHOOK_SECRET: z.string().optional(),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: boolFromString.default(false),

  MAX_UPLOAD_MB: z.coerce.number().default(10),

  // Cloudflare R2 (S3-compatible object storage)
  R2_ACCOUNT_ID:       z.string().min(1),
  R2_ACCESS_KEY_ID:    z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME:      z.string().min(1),
  // Public base URL for the bucket — r2.dev subdomain or custom domain, no trailing slash
  // e.g. https://pub-xxxxxxxxxxxxxxxx.r2.dev  OR  https://cdn.autosahay.com
  R2_PUBLIC_URL:       z.string().url(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  // Razorpay — required for any payment endpoint to work (getGateway() throws
  // without them, see lib/paymentGateway/index.ts). Optional at the schema
  // level only so the server can still boot for unrelated local dev work;
  // production requires all three (checked below).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
export const exotelVirtualNumbers = (env.EXOTEL_VIRTUAL_NUMBERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// Production-only safety net — catch the misconfigurations that silently break or
// weaken a live deployment (insecure cookies, no CORS allowlist, placeholder/dupe
// JWT secrets). Fail fast at boot rather than shipping an insecure server.
if (env.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (!env.COOKIE_SECURE) problems.push('COOKIE_SECURE must be true in production (cookies sent over HTTPS only)');
  if (corsOrigins.length === 0) problems.push('CORS_ORIGINS must list at least one allowed origin in production');
  if (/replace_with|change.?me|example|secret_minimum/i.test(env.JWT_ACCESS_SECRET)) {
    problems.push('JWT_ACCESS_SECRET still looks like a placeholder — set a real random secret (openssl rand -hex 32)');
  }
  if (/replace_with|change.?me|example|secret_32_chars/i.test(env.JWT_REFRESH_SECRET)) {
    problems.push('JWT_REFRESH_SECRET still looks like a placeholder — set a real random secret (openssl rand -hex 32)');
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }
  if (/^0{64}$|^1{64}$|replace_with|change.?me|example/i.test(env.QR_DATA_KEY)) {
    problems.push('QR_DATA_KEY still looks like a placeholder — set a real random key (openssl rand -hex 32)');
  }
  // Razorpay: all three required in production — there's no fallback gateway,
  // so a missing/partial config means every payment endpoint 500s at request
  // time instead of failing loudly at boot, which is worse.
  const rzpVars = [env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET];
  const rzpSetCount = rzpVars.filter(Boolean).length;
  if (rzpSetCount < 3) {
    problems.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET must all be set — there is no demo/fallback gateway');
  }
  // Exotel: only required if it's actually the selected call provider — the
  // mock provider stays valid in production for as long as no real vendor is wired up.
  if (env.CALL_PROVIDER === 'exotel') {
    const exotelVars = [env.EXOTEL_API_KEY, env.EXOTEL_API_TOKEN, env.EXOTEL_ACCOUNT_SID, env.EXOTEL_WEBHOOK_SECRET];
    if (exotelVars.filter(Boolean).length < exotelVars.length || exotelVirtualNumbers.length === 0) {
      problems.push('CALL_PROVIDER=exotel but EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_ACCOUNT_SID / EXOTEL_VIRTUAL_NUMBERS / EXOTEL_WEBHOOK_SECRET must all be set');
    }
  }
  if (problems.length > 0) {
    console.error('Refusing to start — production environment is misconfigured:');
    for (const p of problems) console.error(`  • ${p}`);
    process.exit(1);
  }
}
