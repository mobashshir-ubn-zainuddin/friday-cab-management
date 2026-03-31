import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

import { verifySupabaseUser } from '../middleware/supabaseAuth';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Sync Supabase user to Prisma DB
router.post('/sync-user', verifySupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    // User is already synced and attached to req by verifySupabaseUser middleware
    res.json({
      success: true,
      data: {
        user: (req as any).user
      }
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync user data'
    });
  }
});

// Get current user (updated to use Supabase token)
router.get('/me', verifySupabaseUser, async (req: AuthenticatedRequest, res) => {
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

    // Check for pending payments
    const pendingPayments = await prisma.payment.count({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'FAILED'] }
      }
    });

    res.json({
      success: true,
      data: {
        ...user,
        hasPendingPayments: pendingPayments > 0
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data'
    });
  }
});

// Logout
router.post('/logout', verifySupabaseUser, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
