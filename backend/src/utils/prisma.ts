import { PrismaClient, User, Prisma } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    // Disable Prisma's connection pool when using PgBouncer in transaction mode
    // PgBouncer manages connections, so we don't need Prisma's pool
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

// Add connection error handling
prisma.$on('error' as never, (e: any) => {
  console.error('[Prisma] Connection error:', e.message || e);
});

prisma.$on('warn' as never, (e: any) => {
  console.warn('[Prisma] Warning:', e.message || e);
});

// Add query timing middleware using Prisma middleware
if (process.env.NODE_ENV === 'development') {
  prisma.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
    const startTime = process.hrtime.bigint();
    const result = await next(params);
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    
    if (durationMs > 100) {
      console.log(`[Prisma Slow Query] ${params.model}.${params.action} - ${durationMs.toFixed(2)}ms`);
    }
    
    return result;
  });
}

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Process-level TTL cache — survives across requests so the same token
// doesn't hit Supabase Auth on every API call (the dominant latency source).
// 5-minute TTL: short enough to pick up logouts/blocks, long enough to cut
// per-request Supabase round-trips to near-zero after the first call.
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  user: User;
  expiresAt: number;
}

const userCache = new Map<string, CacheEntry>();

export const getCachedUser = (key: string): User | undefined => {
  const entry = userCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(key);
    return undefined;
  }
  return entry.user;
};

export const setCachedUser = (key: string, user: User): void => {
  userCache.set(key, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
};

// Kept for API compatibility; individual entries now expire via TTL.
export const clearRequestUserCache = (): void => {
  // no-op: cache is now process-level, not request-scoped
};

// Immediately evict all cache entries for a given email.
// Call this after any admin action that changes a user's status
// (approve, reject, block, unblock) so the next request gets a fresh DB read
// instead of a stale cached record.
export const invalidateCacheForEmail = (email: string): void => {
  const emailKey = `email:${email}`;
  userCache.delete(emailKey);
  // Also evict any token-keyed entries for this user (iterate to find them)
  for (const [key, entry] of userCache.entries()) {
    if (entry.user.email === email) {
      userCache.delete(key);
    }
  }
};

export default prisma;
export { prisma };