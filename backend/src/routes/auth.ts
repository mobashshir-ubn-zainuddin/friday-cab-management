import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

import { verifySupabaseUser } from '../middleware/supabaseAuth';
import { validateBody } from '../middleware/validation';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const signupSchema = z.object({
  emailPrefix: z
    .string()
    .min(2, 'Email prefix is required')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Email prefix can only contain letters, numbers, dots, underscores and hyphens')
    .transform((v) => v.toLowerCase().trim()),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^[0-9+\-\s]+$/, 'Phone number can only contain digits, +, - and spaces')
    .trim(),
  rollNumber: z
    .string()
    .min(4, 'Roll number must be at least 4 characters')
    .max(20, 'Roll number must be less than 20 characters')
    .trim(),
  department: z
    .string()
    .min(2, 'Department is required')
    .max(100, 'Department must be less than 100 characters')
    .trim()
});

// Public: Register a new user
router.post('/signup', validateBody(signupSchema), async (req, res) => {
  try {
    const { emailPrefix, name, phone, rollNumber, department } = req.body;
    const email = `${emailPrefix}@kgpian.iitkgp.ac.in`;

    // Check for existing user by email
    const existingByEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingByEmail) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists. Please sign in instead.'
      });
    }

    // Check for existing user by rollNumber (nullable unique)
    if (rollNumber) {
      const existingByRoll = await prisma.user.findUnique({
        where: { rollNumber }
      });

      if (existingByRoll) {
        return res.status(409).json({
          success: false,
          error: 'An account with this roll number already exists.'
        });
      }
    }

    // Determine admin status
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) || [];
    const isAdmin = adminEmails.includes(email.toLowerCase());

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        rollNumber,
        department,
        isAdmin,
        isBlocked: false
      },
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

    return res.status(201).json({
      success: true,
      message: 'Registration successful. A sign-in link has been sent to your email.',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register user. Please try again later.'
    });
  }
});

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
