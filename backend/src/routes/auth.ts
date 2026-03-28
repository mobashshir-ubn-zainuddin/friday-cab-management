import { Router } from 'express';
import passport from 'passport';
import { generateToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Get current user
router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
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

// Refresh token
router.post('/refresh', authenticate, (req: AuthenticatedRequest, res) => {
  const token = generateToken({
    userId: req.user!.id,
    email: req.user!.email,
    isAdmin: req.user!.isAdmin
  });

  res.json({
    success: true,
    data: { token }
  });
});

// Logout
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Register with email prefix and password
const registerSchema = z.object({
  emailPrefix: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
  rollNumber: z.string().min(1),
  department: z.string().min(1),
  phone: z.string().min(10)
});

router.post('/register', async (req, res) => {
  try {
    const { emailPrefix, name, password, rollNumber, department, phone } = registerSchema.parse(req.body);
    const email = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Check if roll number already exists
    const existingRoll = await prisma.user.findUnique({
      where: { rollNumber: rollNumber.trim() }
    });

    if (existingRoll) {
      return res.status(400).json({
        success: false,
        error: 'User with this roll number already exists'
      });
    }

    // Check if admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    const isAdmin = adminEmails.includes(email);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        rollNumber: rollNumber.trim(),
        department: department.trim(),
        phone: phone.trim(),
        isAdmin,
        isBlocked: false
      }
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          hasPendingPayments: false
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
});

// Login with email prefix and password
const loginSchema = z.object({
  emailPrefix: z.string().min(1),
  password: z.string().min(1)
});

router.post('/login', async (req, res) => {
  try {
    const { emailPrefix, password } = loginSchema.parse(req.body);
    const email = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact admin.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check for pending payments
    const pendingPayments = await prisma.payment.count({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'FAILED'] }
      }
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          rollNumber: user.rollNumber,
          department: user.department,
          isAdmin: user.isAdmin,
          hasPendingPayments: pendingPayments > 0
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message
      });
    }
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process login'
    });
  }
});

// Supabase OAuth callback - Sync user with database
const supabaseCallbackSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  avatar_url: z.string().url().optional(),
  provider: z.string(),
  provider_id: z.string()
});

router.post('/supabase/callback', async (req, res) => {
  try {
    const { email, name, avatar_url, provider, provider_id } = supabaseCallbackSchema.parse(req.body);

    // STRICT validation: Only IITKGP emails allowed
    const lowerEmail = email.toLowerCase().trim();
    if (!lowerEmail.endsWith('@kgpian.iitkgp.ac.in')) {
      return res.status(403).json({
        success: false,
        error: 'Only @kgpian.iitkgp.ac.in email addresses are allowed'
      });
    }

    // Extract roll number from email
    const rollNumberMatch = lowerEmail.match(/^([^@]+)@kgpian\.iitkgp\.ac\.in$/);
    const rollNumber = rollNumberMatch ? rollNumberMatch[1] : null;

    // Check if admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    const isAdmin = adminEmails.includes(lowerEmail);

    // Find or create user using upsert
    let user = await (prisma as any).user.findUnique({
      where: { email: lowerEmail }
    });

    if (!user) {
      // Create new user
      user = await (prisma as any).user.create({
        data: {
          email: lowerEmail,
          name,
          rollNumber,
          isAdmin,
          isBlocked: false
        }
      });
    } else {
      // Update user if needed
      if (user.name !== name || user.isAdmin !== isAdmin) {
        user = await (prisma as any).user.update({
          where: { id: user.id },
          data: { name, isAdmin }
        });
      }
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact admin.'
      });
    }

    // Check for pending payments
    const pendingPayments = await (prisma as any).payment.count({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'FAILED'] }
      }
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          rollNumber: user.rollNumber,
          department: user.department,
          isAdmin: user.isAdmin,
          hasPendingPayments: pendingPayments > 0
        }
      }
    });
  } catch (error) {
    console.error('Supabase callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process authentication'
    });
  }
});

export default router;
