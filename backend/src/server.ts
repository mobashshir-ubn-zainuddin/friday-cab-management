import dotenv from 'dotenv';
// Load env vars at the very top to ensure other modules can access them
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { prisma } from './utils/prisma';
import { syncTripStatuses } from './utils/tripStatus';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import tripRoutes from './routes/trip';
import bookingRoutes from './routes/booking';
import paymentRoutes from './routes/payment';
import paymentWebhookRoutes from './routes/paymentWebhook';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';

// Middleware
import { clearUserCacheMiddleware } from './middleware/supabaseAuth';
import { idempotencyMiddleware } from './middleware/idempotency';
import { requestTimingMiddleware } from './middleware/requestTiming';

const app = express();

// Background job: Sync trip statuses every minute
const TRIP_STATUS_SYNC_INTERVAL = 60 * 1000; // 1 minute
setInterval(async () => {
  try {
    await syncTripStatuses(prisma);
  } catch (error) {
    console.error('[Background Job] Error syncing trip statuses:', error);
  }
}, TRIP_STATUS_SYNC_INTERVAL);
console.log(`[Background Job] Trip status sync scheduled every ${TRIP_STATUS_SYNC_INTERVAL / 1000} seconds`);
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS - Allow all origins in development, restrict to FRONTEND_URL in production
const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [FRONTEND_URL]
    : [
        'http://localhost:5173',
        'http://localhost:3000'
      ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Idempotency-Key'],
  exposedHeaders: ['Content-Length', 'X-Total-Count']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
// Razorpay webhook requires raw body for signature verification
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  paymentWebhookRoutes
);

app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
app.use(morgan('dev'));

// Request timing middleware (must be early to measure full request)
app.use(requestTimingMiddleware);

// Request-scoped user cache clearing
app.use(clearUserCacheMiddleware);

// Idempotency middleware for mutations
app.use('/api', (req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return idempotencyMiddleware(req, res, next);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running"
  });
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting Prisma:', error);
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Server startup
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${FRONTEND_URL}`);
});

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

export default app;