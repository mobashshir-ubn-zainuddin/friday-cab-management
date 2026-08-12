import { Request, Response, NextFunction } from 'express';

// Request timing middleware for performance monitoring
export const requestTimingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = process.hrtime.bigint();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  // Add request ID to headers for tracing
  (req as any).requestId = requestId;
  (req as any).startTime = startTime;

  // Log when request finishes
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    
    // Only log slow requests (> 500ms) or errors
    const isSlow = durationMs > 500;
    const isError = res.statusCode >= 400;
    
    if (isSlow || isError) {
      console.log(
        `[Request] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${durationMs.toFixed(2)}ms ${isSlow ? '🐌 SLOW' : ''} ${isError ? '❌ ERROR' : ''} [${requestId}]`
      );
    }
  });

  next();
};

// Prisma query timing extension
// This can be used to wrap Prisma client for query timing
export function createTimedPrismaClient(prisma: any) {
  const originalQuery = prisma.$queryRaw.bind(prisma);
  const originalQueryRawUnsafe = prisma.$queryRawUnsafe?.bind(prisma);
  const originalExecuteRaw = prisma.$executeRaw.bind(prisma);
  const originalExecuteRawUnsafe = prisma.$executeRawUnsafe?.bind(prisma);

  // Wrap queryRaw
  prisma.$queryRaw = async (...args: any[]) => {
    const startTime = process.hrtime.bigint();
    try {
      return await originalQuery(...args);
    } finally {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      if (durationMs > 100) {
        console.log(`[Prisma Query] ${durationMs.toFixed(2)}ms - ${args[0]?.toString().substring(0, 200)}`);
      }
    }
  };

  if (originalQueryRawUnsafe) {
    prisma.$queryRawUnsafe = async (...args: any[]) => {
      const startTime = process.hrtime.bigint();
      try {
        return await originalQueryRawUnsafe(...args);
      } finally {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;
        if (durationMs > 100) {
          console.log(`[Prisma QueryRawUnsafe] ${durationMs.toFixed(2)}ms`);
        }
      }
    };
  }

  if (originalExecuteRaw) {
    prisma.$executeRaw = async (...args: any[]) => {
      const startTime = process.hrtime.bigint();
      try {
        return await originalExecuteRaw(...args);
      } finally {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;
        if (durationMs > 100) {
          console.log(`[Prisma ExecuteRaw] ${durationMs.toFixed(2)}ms`);
        }
      }
    };
  }

  if (originalExecuteRawUnsafe) {
    prisma.$executeRawUnsafe = async (...args: any[]) => {
      const startTime = process.hrtime.bigint();
      try {
        return await originalExecuteRawUnsafe(...args);
      } finally {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;
        if (durationMs > 100) {
          console.log(`[Prisma ExecuteRawUnsafe] ${durationMs.toFixed(2)}ms`);
        }
      }
    };
  }

  return prisma;
}

export default requestTimingMiddleware;