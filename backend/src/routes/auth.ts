import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

import { verifySupabaseUser } from '../middleware/supabaseAuth';
import { validateBody } from '../middleware/validation';
import { sendNewRegistrationToAdmins } from '../utils/email';
import { supabaseAdmin } from '../config/supabaseClient';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const CALLBACK_PATH = '/auth/callback';
const ADMIN_DASHBOARD_USERS = `${FRONTEND_URL}/admin/users`;

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

const getAdminEmails = (): string[] => {
  return (
    process.env.ADMIN_EMAILS?.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) || []
  );
};

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  rollNumber: true,
  department: true,
  isAdmin: true,
  isBlocked: true,
  approvalStatus: true,
  approvalReviewedAt: true,
  rejectionReason: true,
  createdAt: true
} as const;

type PublicUserShape = typeof PUBLIC_USER_SELECT;

// ---------------------------------------------------------------------------
// Public: Register a new user
// ---------------------------------------------------------------------------
// - Admin-whitelisted emails are auto-APPROVED (and their user magic link is
//   the frontend's responsibility to still send).
// - All other new users are held at approvalStatus = PENDING. Admins are
//   emailed the registration details, and NO magic link is sent to the user
//   yet. The frontend will show a "waiting for admin approval" screen.
// - If email already existed: forward existing approval status so frontend
//   can decide whether to still show a waiting screen or send magic link.
router.post('/signup', validateBody(signupSchema), async (req, res) => {
  try {
    const { emailPrefix, name, phone, rollNumber, department } = req.body;
    const email = `${emailPrefix}@kgpian.iitkgp.ac.in`;
    const adminEmails = getAdminEmails();
    const shouldAutoApprove = adminEmails.includes(email.toLowerCase());

    // -----------------------------------------------------------------------
    // 1) Existing user by email
    // -----------------------------------------------------------------------
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
      select: PUBLIC_USER_SELECT
    });

    if (existingByEmail) {
      const needsAdminApproval =
        !existingByEmail.isAdmin && existingByEmail.approvalStatus === 'PENDING';

      // For existing PENDING users, optionally re-notify admins (kept light:
      // do not spam again; rely on original admin notification).
      return res.status(200).json({
        success: true,
        alreadyExisted: true,
        needsAdminApproval,
        approvalStatus: existingByEmail.approvalStatus,
        rejectionReason: existingByEmail.rejectionReason ?? undefined,
        message: needsAdminApproval
          ? 'Your registration is already awaiting admin verification. Please wait for approval. A sign-in link will be emailed once your account is verified.'
          : existingByEmail.approvalStatus === 'REJECTED'
          ? 'Your registration request was not approved. Please contact an administrator.'
          : 'An account with this email already exists. A sign-in link has been sent to your registered email.',
        data: { user: existingByEmail }
      });
    }

    // -----------------------------------------------------------------------
    // 2) Existing user by roll number
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // 3) Create new user
    // -----------------------------------------------------------------------
    const approvalStatus = shouldAutoApprove ? 'APPROVED' : 'PENDING';

    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        rollNumber,
        department,
        isAdmin: shouldAutoApprove,
        isBlocked: false,
        approvalStatus
      },
      select: PUBLIC_USER_SELECT
    });

    // -----------------------------------------------------------------------
    // 4) Notify admins about the new registration (non-admin users only)
    // -----------------------------------------------------------------------
    if (!shouldAutoApprove) {
      setImmediate(async () => {
        try {
          await sendNewRegistrationToAdmins(adminEmails, user, ADMIN_DASHBOARD_USERS);
        } catch (err) {
          console.error('Failed to send admin notification for new registration:', err);
        }
      });
    }

    const needsAdminApproval = !shouldAutoApprove;

    return res.status(201).json({
      success: true,
      alreadyExisted: false,
      needsAdminApproval,
      approvalStatus: user.approvalStatus,
      message: needsAdminApproval
        ? 'Your registration details have been received. Admins have been notified. Once your account is approved by an admin, a secure sign-in link will be sent to your registered email.'
        : 'Registration successful. A sign-in link has been sent to your email.',
      data: { user }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register user. Please try again later.'
    });
  }
});

// ---------------------------------------------------------------------------
// Sync Supabase user to Prisma DB. Also blocks PENDING / REJECTED users from
// establishing a session (the magic link might have been sent before
// approval, or Supabase could allow any user on the project).
// ---------------------------------------------------------------------------
router.post('/sync-user', verifySupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const dbUser = req.user!;

    if (dbUser.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact an administrator.'
      });
    }

    if (dbUser.approvalStatus === 'PENDING') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_PENDING_APPROVAL',
        message: 'Your account is awaiting admin verification. Please wait for an admin to approve your registration.'
      });
    }

    if (dbUser.approvalStatus === 'REJECTED') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_REJECTED',
        message: dbUser.rejectionReason
          ? `Your registration was rejected. Reason: ${dbUser.rejectionReason}`
          : 'Your registration was not approved. Please contact an administrator.'
      });
    }

    const serializable = await prisma.user.findUnique({
      where: { id: dbUser.id },
      select: {
        ...PUBLIC_USER_SELECT,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: { user: serializable }
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync user data'
    });
  }
});

// ---------------------------------------------------------------------------
// Get current user
// ---------------------------------------------------------------------------
router.get('/me', verifySupabaseUser, async (req: AuthenticatedRequest, res) => {
  try {
    const dbUser = req.user!;

    if (dbUser.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact an administrator.'
      });
    }

    if (dbUser.approvalStatus === 'PENDING') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_PENDING_APPROVAL',
        message: 'Your account is awaiting admin verification.'
      });
    }

    if (dbUser.approvalStatus === 'REJECTED') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_REJECTED',
        message: dbUser.rejectionReason
          ? `Your registration was rejected. Reason: ${dbUser.rejectionReason}`
          : 'Your registration was not approved.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      select: PUBLIC_USER_SELECT
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

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

// ---------------------------------------------------------------------------
// Admin only: Approve a pending user and send the Supabase magic link to
// the user's email. Approval is idempotent — re-approving re-sends the link
// (useful if the user says they never received it).
// ---------------------------------------------------------------------------
router.post(
  '/admin/users/:id/approve',
  verifySupabaseUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const admin = req.user!;
      if (!admin.isAdmin) {
        return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
      }

      const { id } = req.params;

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      if (target.isAdmin) {
        return res
          .status(400)
          .json({ success: false, error: 'Admin accounts do not need manual approval.' });
      }

      await prisma.user.update({
        where: { id },
        data: {
          approvalStatus: 'APPROVED',
          approvalReviewedAt: new Date(),
          approvalReviewedBy: admin.id,
          rejectionReason: null
        }
      });

      // Send the sign-in link (magic link) to the user. Prefer the
      // supabaseAdmin client so we can trigger this from the backend without
      // the user present. If service-role client is not configured, fall
      // back to the regular client which will still send the email.
      const client = (supabaseAdmin as any) || (require('../config/supabaseClient').supabase as any);
      const redirectTo = `${FRONTEND_URL}${CALLBACK_PATH}`;
      const { error: sbErr } = await client.auth.signInWithOtp({
        email: target.email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
      });

      if (sbErr) {
        console.error(`Supabase send OTP failed for ${target.email}:`, sbErr);
        return res.status(502).json({
          success: false,
          error: `User was approved, but we couldn't email the sign-in link: ${sbErr.message}. The admin can try again by clicking Approve once more.`
        });
      }

      res.json({
        success: true,
        message: `${target.name} has been approved and a sign-in link was emailed to ${target.email}.`
      });
    } catch (error) {
      console.error('Approve user error:', error);
      res.status(500).json({ success: false, error: 'Failed to approve user.' });
    }
  }
);

// ---------------------------------------------------------------------------
// Admin only: Reject a pending user by permanently deleting their record from
// both the application database and Supabase Auth.
// ---------------------------------------------------------------------------
router.post(
  '/admin/users/:id/reject',
  verifySupabaseUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const admin = req.user!;
      if (!admin.isAdmin) {
        return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
      }
      const { id } = req.params;

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
      if (target.isAdmin) {
        return res.status(400).json({ success: false, error: 'Admin accounts cannot be rejected via this workflow.' });
      }
      if (target.approvalStatus !== 'PENDING') {
        return res.status(400).json({ success: false, error: 'Only pending users can be rejected.' });
      }

      // 1) Delete from application DB
      await prisma.user.delete({
        where: { id }
      });

      // 2) Delete from Supabase Auth
      const { error: sbErr } = await supabaseAdmin.auth.admin.deleteUser(target.email);
      if (sbErr) {
        console.error(`Failed to delete Supabase user for ${target.email}:`, sbErr);
        // We continue because the application record is already gone.
      }

      res.json({
        success: true,
        message: `${target.name}'s registration has been rejected and all account data deleted.`
      });
    } catch (error) {
      console.error('Reject user error:', error);
      res.status(500).json({ success: false, error: 'Failed to reject and delete user.' });
    }
  }
);

// Logout
router.post('/logout', verifySupabaseUser, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
