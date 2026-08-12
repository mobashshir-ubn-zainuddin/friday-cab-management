import { Request, Response, NextFunction } from 'express';

// In-memory idempotency store (use Redis in production for multi-instance deployments)
// Stores completed responses
const idempotencyStore = new Map<string, { statusCode: number; body: any; expiresAt: number }>();
// Tracks in-flight requests to prevent duplicate execution
const inFlightRequests = new Map<string, Promise<{ statusCode: number; body: any }>>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (value.expiresAt < now) {
      idempotencyStore.delete(key);
    }
  }
  // Also clean up any stale in-flight requests (older than 5 minutes)
  for (const [key, promise] of inFlightRequests.entries()) {
    // We can't easily check promise age, but we can try to clean up resolved ones
    // This is a best-effort cleanup
    promise.then(() => inFlightRequests.delete(key)).catch(() => inFlightRequests.delete(key));
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

  // Check if we have a cached response (completed request)
  const cached = idempotencyStore.get(idempotencyKey);
  if (cached) {
    console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  // Check if there's an in-flight request with the same key
  const inFlight = inFlightRequests.get(idempotencyKey);
  if (inFlight) {
    console.log(`[Idempotency] Waiting for in-flight request: ${idempotencyKey}`);
    // Wait for the in-flight request to complete and return its result
    inFlight
      .then(({ statusCode, body }) => {
        if (!res.headersSent) {
          res.status(statusCode).json(body);
        }
      })
      .catch((err) => {
        if (!res.headersSent) {
          console.error(`[Idempotency] In-flight request failed: ${idempotencyKey}`, err);
          res.status(500).json({ success: false, error: 'Request failed' });
        }
      });
    return;
  }

  // Wrap res.json to cache the response
  const originalJson = res.json.bind(res);
  let responseCaptured = false;
  
  const captureResponse = (body: any): Response => {
    if (!responseCaptured) {
      responseCaptured = true;
      const statusCode = res.statusCode;
      // Cache both successful and error responses (but not 5xx server errors which might be transient)
      if (statusCode < 500) {
        idempotencyStore.set(idempotencyKey, {
          statusCode,
          body,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        });
      }
      // Clean up in-flight tracker
      inFlightRequests.delete(idempotencyKey);
    }
    return originalJson(body);
  };

  // Create a promise that resolves when the response is sent
  const responsePromise = new Promise<{ statusCode: number; body: any }>((resolve) => {
    const originalOnFinish = res.on.bind(res);
    res.on('finish', () => {
      // The response has been sent, resolve with captured data
      // We need to capture the body before it's sent
    });
    
    // Override json to capture the response body
    res.json = ((body: any): Response => {
      const result = captureResponse(body);
      resolve({ statusCode: res.statusCode, body });
      return result;
    }) as any;
  });

  // Track this in-flight request
  inFlightRequests.set(idempotencyKey, responsePromise);

  // Clean up in-flight tracker on response finish (in case json wasn't called)
  res.on('finish', () => {
    if (!responseCaptured) {
      inFlightRequests.delete(idempotencyKey);
    }
  });

  next();
};

export default idempotencyMiddleware;