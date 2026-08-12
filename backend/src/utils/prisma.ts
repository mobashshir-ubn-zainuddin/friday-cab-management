import { PrismaClient, User } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    // Connection pool settings for Supabase PgBouncer
    // PgBouncer works best with smaller pool sizes
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
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

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Request-scoped user cache
const requestUserCache = new Map<string, User>();

export const getCachedUser = (key: string): User | undefined => {
  return requestUserCache.get(key);
};

export const setCachedUser = (key: string, user: User): void => {
  requestUserCache.set(key, user);
};

export const clearRequestUserCache = (): void => {
  requestUserCache.clear();
};

export default prisma;
export { prisma };