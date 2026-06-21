import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { env } from '../config/env.js';

const base = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * When DATABASE_URL is a Prisma Accelerate URL (prisma://…), queries run through
 * Accelerate's edge (connection pool + query engine in Prisma's cloud), so NO
 * local query engine runs at runtime — which permanently avoids the Hostinger
 * CloudLinux "timer has gone away" engine crash.
 *
 * With a direct mysql:// URL (e.g. local dev), the extension is a no-op and the
 * normal local engine is used.
 */
// Apply the Accelerate extension at runtime, but keep the plain PrismaClient type:
// we don't use Accelerate's `cacheStrategy` API, and casting to the base type
// preserves all existing query-result inference across the codebase.
export const prisma = base.$extends(withAccelerate()) as unknown as typeof base;

process.on('beforeExit', async () => {
  await base.$disconnect();
});
