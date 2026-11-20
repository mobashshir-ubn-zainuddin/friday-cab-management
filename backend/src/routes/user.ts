import { Router } from 'express';
import { z } from 'zod';
import { prisma, invalidateCacheForEmail } from '../utils/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Validation schema for updating user
const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().regex(/^[0-9]{10}$/).optional(),
  department: z.string().optional(),
  hall: z.string().optional(),
  rollNumber: z.string().optional()
});

// Get user dashboard stats
router.get('/dashboard', authenticate, async (req: AuthenticatedRequest, res) => {
  const requestId = (req as any).requestId || 'unknown';
  const overallStart = process.hrtime.bigint();
  
  try {
    const userId = req.user!.id;

    // One round trip instead of six parallel queries competing for pool connections.
    // Timestamp columns hold naive UTC values, so compare against a naive UTC literal.
    const nowUtc = new Date().toISOString();
    const queryStart = process.hrtime.bigint();
    const [row] = await prisma.$queryRaw<any[]>`
      SELECT
        (SELECT COUNT(*) FROM "Booking" WHERE "userId" = ${userId} AND status IN ('ATTENDED', 'NO_SHOW')) AS "totalTrips",
        (SELECT COUNT(*) FROM "Booking" b JOIN "Trip" t ON t.id = b."tripId"
          WHERE b."userId" = ${userId} AND b.status = 'CONFIRMED'
            AND t.status IN ('UPCOMING', 'BOOKING_OPEN', 'BOOKING_CLOSED', 'CAB_ASSIGNED')) AS "activeBookings",
        (SELECT COUNT(*) FROM "Booking" WHERE "userId" = ${userId} AND status = 'ATTENDED') AS "completedTrips",
        (SELECT COUNT(*) FROM "Booking" b JOIN "Trip" t ON t.id = b."tripId"
          WHERE b."userId" = ${userId} AND b.status = 'CONFIRMED'
            AND t."departureTime" >= ${nowUtc}::timestamp) AS "upcomingTrips",
        (SELECT COUNT(*) FROM "Payment" WHERE "userId" = ${userId} AND status = 'PENDING') AS "pendingPayments",
        (SELECT COALESCE(SUM(amount), 0) FROM "Payment" WHERE "userId" = ${userId} AND status = 'COMPLETED') AS "totalSpent"
    `;
    const queryMs = Number(process.hrtime.bigint() - queryStart) / 1_000_000;

    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    
    // Log detailed timing for slow requests
    if (totalMs > 500 || queryMs > 300) {
      console.log(`[User GET /dashboard] Request ${requestId} - Total: ${totalMs.toFixed(2)}ms, Queries: ${queryMs.toFixed(2)}ms`);
    }

    res.json({
      success: true,
      data: {
        totalTrips: Number(row.totalTrips),
        activeBookings: Number(row.activeBookings),
        completedTrips: Number(row.completedTrips),
        upcomingTrips: Number(row.upcomingTrips),
        pendingPayments: Number(row.pendingPayments),
        totalSpent: Number(row.totalSpent)
      }
    });
  } catch (error) {
    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    console.error(`[User GET /dashboard] Request ${requestId} failed after ${totalMs.toFixed(2)}ms:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    });
  }
});

// Get current user profile
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        rollNumber: true,
        department: true,
        hall: true,
        isAdmin: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Update user profile
router.patch('/profile', authenticate, validateBody(updateUserSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, phone, department, hall, rollNumber } = req.body;

    // Check if roll number already exists if provided
    if (rollNumber) {
      const existingRoll = await prisma.user.findFirst({
        where: { 
          rollNumber: rollNumber.trim(),
          id: { not: req.user!.id }
        }
      });

      if (existingRoll) {
        return res.status(400).json({
          success: false,
          error: 'Roll number already in use by another student'
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(department && { department }),
        ...(hall && { hall }),
        ...(rollNumber && { rollNumber: rollNumber.trim() })
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        rollNumber: true,
        department: true,
        hall: true,
        isAdmin: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Get all users (admin only)
router.get('/', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { rollNumber: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          rollNumber: true,
          department: true,
          hall: true,
          isAdmin: true,
          isBlocked: true,
          approvalStatus: true,
          approvalReviewedAt: true,
          approvalReviewedBy: true,
          rejectionReason: true,
          createdAt: true,
          _count: {
            select: {
              bookings: true,
              payments: {
                where: { status: 'PENDING' }
              }
            }
          }
        },
        orderBy: [
          { approvalStatus: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limitNum
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Block/unblock user (admin only)
router.patch('/:id/block', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { isBlocked },
      select: {
        id: true,
        name: true,
        email: true,
        isBlocked: true
      }
    });

    // Flush cached record so the block takes effect immediately on next request
    invalidateCacheForEmail(user.email);

    res.json({
      success: true,
      data: user,
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`
    });
  } catch (error) {
    console.error('Error updating user block status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
});

// Make user admin (admin only)
router.patch('/:id/admin', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { isAdmin },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true
      }
    });

    invalidateCacheForEmail(user.email);

    res.json({
      success: true,
      data: user,
      message: `User admin status ${isAdmin ? 'granted' : 'revoked'} successfully`
    });
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin status'
    });
  }
});

export default router;
