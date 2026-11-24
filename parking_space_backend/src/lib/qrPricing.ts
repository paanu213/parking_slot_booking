/**
 * QR sticker price (pack of 2), set by admin on the QR Config page and stored
 * in the Setting table. New orders snapshot this price onto
 * QrOrder.stickerPricePaise at creation, so changing it never alters orders
 * that already exist (paid, pending or refunded): they keep their own price.
 */
import { prisma } from './prisma.js';
import { cachedSetting, invalidateSetting } from './settingsCache.js';

const KEY = 'qr_sticker_price_paise';
export const DEFAULT_STICKER_PRICE_PAISE = 50_000; // ₹500
export const MIN_STICKER_PRICE_PAISE = 100;        // ₹1
export const MAX_STICKER_PRICE_PAISE = 10_000_000; // ₹1,00,000

export const getStickerPricePaise = (): Promise<number> =>
  cachedSetting(KEY, async () => {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const n = row ? Number(row.value) : NaN;
    return Number.isInteger(n) && n >= MIN_STICKER_PRICE_PAISE && n <= MAX_STICKER_PRICE_PAISE ? n : DEFAULT_STICKER_PRICE_PAISE;
  });

export const setStickerPricePaise = async (paise: number): Promise<number> => {
  const clamped = Math.min(MAX_STICKER_PRICE_PAISE, Math.max(MIN_STICKER_PRICE_PAISE, Math.round(paise)));
  await prisma.setting.upsert({
    where:  { key: KEY },
    create: { key: KEY, value: String(clamped) },
    update: { value: String(clamped) },
  });
  invalidateSetting(KEY);
  return clamped;
};
