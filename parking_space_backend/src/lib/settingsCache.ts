/**
 * Tiny in-memory cache for admin settings (sticker price, commission rate,
 * call limits). These are read on many requests (price page, every order, the
 * scan-and-call path) but change rarely, so each was a needless database round
 * trip.
 *
 * - A value is reused for at most `ttlMs` (default 60 s).
 * - Saving a setting calls `invalidateSetting(key)`, so on this server the new
 *   value applies immediately; any other server process picks it up within the TTL.
 * - Concurrent first reads share one database query.
 */
const DEFAULT_TTL_MS = 60_000;

const store = new Map<string, { value: unknown; expires: number }>();
const inFlight = new Map<string, Promise<unknown>>();

export const cachedSetting = async <T>(key: string, load: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> => {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const p = load()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
};

export const invalidateSetting = (key: string) => {
  store.delete(key);
};
