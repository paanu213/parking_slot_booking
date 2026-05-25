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

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

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

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

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
