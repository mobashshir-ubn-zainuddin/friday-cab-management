import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Validation schema for updating user
const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().regex(/^[0-9]{10}$/).optional(),
  department: z.string().optional()
});

// Get user dashboard stats
router.get('/dashboard', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get total trips (completed bookings)
    const totalTrips = await prisma.booking.count({
      where: {
        userId,
        status: { in: ['ATTENDED', 'NO_SHOW'] }
      }
    });

    // Get active bookings (confirmed bookings for upcoming trips)
    const activeBookings = await prisma.booking.count({
      where: {
        userId,
        status: 'CONFIRMED',
        trip: {
          status: { in: ['UPCOMING', 'BOOKING_OPEN', 'BOOKING_CLOSED', 'CAB_ASSIGNED'] }
        }
      }
    });

    // Get completed trips
    const completedTrips = await prisma.booking.count({
      where: {
        userId,
        status: 'ATTENDED'
      }
    });

    // Get upcoming trips
    const upcomingTrips = await prisma.booking.count({
      where: {
        userId,
        status: 'CONFIRMED',
        trip: {
          date: { gte: new Date() }
        }
      }
    });

    // Get pending payments
    const pendingPayments = await prisma.payment.count({
      where: {
        userId,
        status: 'PENDING'
      }
    });

    // Get total spent
    const totalSpent = await prisma.payment.aggregate({
      where: {
        userId,
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });

    res.json({
      success: true,
      data: {
        totalTrips,
        activeBookings,
        completedTrips,
        upcomingTrips,
        pendingPayments,
        totalSpent: totalSpent._sum.amount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
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
    const { name, phone, department } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(department && { department })
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        rollNumber: true,
        department: true,
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
          isAdmin: true,
          isBlocked: true,
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
        orderBy: { createdAt: 'desc' },
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
