import { PrismaClient, User, Prisma } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
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