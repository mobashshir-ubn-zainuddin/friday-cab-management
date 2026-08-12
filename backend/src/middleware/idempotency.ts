import { Request, Response, NextFunction } from 'express';

// Simple in-memory idempotency store (use Redis in production)
const idempotencyStore = new Map<string, { statusCode: number; body: any; expiresAt: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (value.expiresAt < now) {
      idempotencyStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const idempotencyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return next();
  }

  // Check if we have a cached response
  const cached = idempotencyStore.get(idempotencyKey);
  if (cached) {
    console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  // Wrap res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = (body: any): Response => {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(idempotencyKey, {
        statusCode: res.statusCode,
        body,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      });
    }
    return originalJson(body);
  };

  next();
};

export default idempotencyMiddleware;