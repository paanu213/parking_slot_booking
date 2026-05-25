import sharp from 'sharp';
import { nanoid } from 'nanoid';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

// ── Allowed MIME types ────────────────────────────────────────────────────────
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOC_MIMES   = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// ── R2 client (S3-compatible) ─────────────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

// ── Key builder — YYYY/MM/<prefix><id>.<ext> ──────────────────────────────────
const buildKey = (prefix: string, ext: string): string => {
  const now  = new Date();
  const yyyy = String(now.getFullYear());
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${prefix}${nanoid(16)}.${ext}`;
};

// ── Upload a buffer to R2 and return the public URL ───────────────────────────
const upload = async (key: string, body: Buffer, contentType: string): Promise<string> => {
  await r2.send(new PutObjectCommand({
    Bucket:      env.R2_BUCKET_NAME,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }));
  return `${env.R2_PUBLIC_URL}/${key}`;
};

// ── StoredImage (keeps the same shape the rest of the app expects) ────────────
export interface StoredImage {
  id:           string;
  relativePath: string; // the R2 object key, e.g. 2026/05/abc.webp
  url:          string;
  width:        number;
  height:       number;
  size:         number;
}

// ── Store a parking-space / location image (compressed WebP) ─────────────────
export const storeImageBuffer = async (buffer: Buffer): Promise<StoredImage> => {
  const id  = nanoid(16);
  const key = buildKey('', 'webp').replace(/[^/]+$/, `${id}.webp`); // keep YYYY/MM/ prefix

  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  const url = await upload(key, data, 'image/webp');

  return { id, relativePath: key, url, width: info.width, height: info.height, size: info.size };
};

// ── Store an amenity icon (small square, compressed WebP) ─────────────────────
export const storeIconBuffer = async (buffer: Buffer): Promise<StoredImage> => {
  const id  = nanoid(16);
  const key = buildKey('icon-', 'webp').replace(/icon-[^/]+$/, `icon-${id}.webp`);

  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(96, 96, { fit: 'cover', position: 'centre' })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  const url = await upload(key, data, 'image/webp');

  return { id, relativePath: key, url, width: info.width, height: info.height, size: info.size };
};

// ── Store a document (Aadhar etc.) — image or PDF ────────────────────────────
export const storeDocumentBuffer = async (
  buffer: Buffer,
  mimeType: string,
): Promise<{ url: string }> => {
  let body: Buffer;
  let contentType: string;
  let key: string;

  if (mimeType === 'application/pdf') {
    body        = buffer;
    contentType = 'application/pdf';
    key         = buildKey('doc-', 'pdf');
  } else {
    body = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    contentType = 'image/webp';
    key         = buildKey('doc-', 'webp');
  }

  const url = await upload(key, body, contentType);
  return { url };
};

// ── Delete helpers — extract R2 key from the public URL and delete ────────────
const urlToKey = (url: string): string | null => {
  const prefix = `${env.R2_PUBLIC_URL}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
};

export const deleteImageByUrl = async (url: string): Promise<void> => {
  const key = urlToKey(url);
  if (!key) return;
  await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })).catch(() => undefined);
};

export const deleteDocumentByUrl = async (url: string): Promise<void> => {
  const key = urlToKey(url);
  if (!key) return;
  await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })).catch(() => undefined);
};
