/**
 * One-shot migration: re-upload legacy `http://localhost:4000/static/...` files
 * to Cloudflare R2 and rewrite the DB rows to use the R2 public URL.
 *
 * Why: an earlier version of this backend served images from the local disk
 * via a `/static` route. The backend was later refactored to upload to R2,
 * but rows from before the refactor still point at the now-removed `/static`
 * route. The files themselves are still in `parking_space_backend/uploads/`.
 *
 * Run from `parking_space_backend/`:
 *
 *   npx tsx prisma/migrate-legacy-uploads.ts          # apply for real
 *   npx tsx prisma/migrate-legacy-uploads.ts --dry    # report only, no writes
 *
 * Idempotent: re-running is safe. Rows already on R2 are skipped, and
 * already-uploaded R2 keys are overwritten (same bytes).
 */

import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const LEGACY_PREFIX = 'http://localhost:4000/static/';
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const DRY_RUN = process.argv.includes('--dry');

const env = {
  R2_ACCOUNT_ID:        process.env.R2_ACCOUNT_ID        ?? '',
  R2_ACCESS_KEY_ID:     process.env.R2_ACCESS_KEY_ID     ?? '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? '',
  R2_BUCKET_NAME:       process.env.R2_BUCKET_NAME       ?? '',
  R2_PUBLIC_URL:        process.env.R2_PUBLIC_URL        ?? '',
};

for (const [k, v] of Object.entries(env)) {
  if (!v) {
    console.error(`Missing required env var ${k}`);
    process.exit(1);
  }
}

const prisma = new PrismaClient();

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const inferContentType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'webp': return 'image/webp';
    case 'png':  return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'pdf':  return 'application/pdf';
    default:     return 'application/octet-stream';
  }
};

interface MigrationResult {
  ok: boolean;
  newUrl?: string;
  reason?: string;
}

const migrateUrl = async (url: string): Promise<MigrationResult> => {
  if (!url.startsWith(LEGACY_PREFIX)) {
    return { ok: false, reason: 'not a legacy URL' };
  }
  const key = url.slice(LEGACY_PREFIX.length); // e.g. 2026/05/abc.webp
  const localPath = path.join(UPLOADS_DIR, key);
  if (!fs.existsSync(localPath)) {
    return { ok: false, reason: `missing local file: ${localPath}` };
  }

  const newUrl = `${env.R2_PUBLIC_URL}/${key}`;

  if (DRY_RUN) {
    return { ok: true, newUrl };
  }

  const body = fs.readFileSync(localPath);
  await r2.send(new PutObjectCommand({
    Bucket:      env.R2_BUCKET_NAME,
    Key:         key,
    Body:        body,
    ContentType: inferContentType(key),
  }));
  return { ok: true, newUrl };
};

const stats = { migrated: 0, skipped: 0, failed: 0 };

const migrateOne = async (
  label: string,
  url: string | null | undefined,
  apply: (newUrl: string) => Promise<void>,
) => {
  if (!url) {
    stats.skipped++;
    return;
  }
  const result = await migrateUrl(url);
  if (!result.ok) {
    stats.failed++;
    console.log(`  ✗ ${label}: ${result.reason}`);
    return;
  }
  if (!DRY_RUN) await apply(result.newUrl!);
  stats.migrated++;
  console.log(`  ${DRY_RUN ? '·' : '✓'} ${label}`);
  console.log(`      ${url}`);
  console.log(`   →  ${result.newUrl}`);
};

async function main() {
  console.log(`\n=== Legacy upload migration ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===\n`);

  // 1) Location images
  const images = await prisma.locationImage.findMany({
    where: { url: { startsWith: LEGACY_PREFIX } },
    select: { id: true, url: true, locationId: true },
  });
  console.log(`\n--- LocationImage: ${images.length} legacy rows ---`);
  for (const img of images) {
    await migrateOne(
      `LocationImage ${img.id} (loc ${img.locationId})`,
      img.url,
      (newUrl) => prisma.locationImage.update({ where: { id: img.id }, data: { url: newUrl } }).then(() => undefined),
    );
  }

  // 2) Vendor aadhar docs
  const vendors = await prisma.vendor.findMany({
    where: { aadharDocUrl: { startsWith: LEGACY_PREFIX } },
    select: { id: true, aadharDocUrl: true, businessName: true },
  });
  console.log(`\n--- Vendor.aadharDocUrl: ${vendors.length} legacy rows ---`);
  for (const v of vendors) {
    await migrateOne(
      `Vendor ${v.id} (${v.businessName}) aadhar`,
      v.aadharDocUrl,
      (newUrl) => prisma.vendor.update({ where: { id: v.id }, data: { aadharDocUrl: newUrl } }).then(() => undefined),
    );
  }

  // 3) User avatars
  const users = await prisma.user.findMany({
    where: { avatarUrl: { startsWith: LEGACY_PREFIX } },
    select: { id: true, avatarUrl: true, email: true },
  });
  console.log(`\n--- User.avatarUrl: ${users.length} legacy rows ---`);
  for (const u of users) {
    await migrateOne(
      `User ${u.id} (${u.email}) avatar`,
      u.avatarUrl,
      (newUrl) => prisma.user.update({ where: { id: u.id }, data: { avatarUrl: newUrl } }).then(() => undefined),
    );
  }

  // 4) Amenity icons (icon column can hold a URL too)
  const amenities = await prisma.amenity.findMany({
    where: { icon: { startsWith: LEGACY_PREFIX } },
    select: { id: true, icon: true, name: true },
  });
  console.log(`\n--- Amenity.icon: ${amenities.length} legacy rows ---`);
  for (const a of amenities) {
    await migrateOne(
      `Amenity ${a.id} (${a.name}) icon`,
      a.icon,
      (newUrl) => prisma.amenity.update({ where: { id: a.id }, data: { icon: newUrl } }).then(() => undefined),
    );
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Migrated: ${stats.migrated}`);
  console.log(`  Skipped:  ${stats.skipped}`);
  console.log(`  Failed:   ${stats.failed}`);
  console.log(DRY_RUN ? '\n(dry run — no DB or R2 writes were performed)\n' : '\nDone.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
