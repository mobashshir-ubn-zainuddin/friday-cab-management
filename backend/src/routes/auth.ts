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
// Uses cached user from verifySupabaseUser middleware to avoid extra DB query.
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

    // Check pending payments (lightweight count query)
    const pendingPayments = await prisma.payment.count({
      where: {
        userId: dbUser.id,
        status: { in: ['PENDING', 'FAILED'] }
      }
    });

    // Construct response from cached user data + pending payments
    const serializable = {
      ...dbUser,
      hasPendingPayments: pendingPayments > 0,
      updatedAt: dbUser.updatedAt
    };

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
// Uses cached user from verifySupabaseUser middleware to avoid extra DB query.
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

    // Check pending payments (lightweight count query)
    const pendingPayments = await prisma.payment.count({
      where: {
        userId: dbUser.id,
        status: { in: ['PENDING', 'FAILED'] }
      }
    });

    // Construct response from cached user data + pending payments
    const userResponse = {
      ...dbUser,
      hasPendingPayments: pendingPayments > 0
    };

    res.json({
      success: true,
      data: userResponse
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
// the user's email.
// - Idempotent: if already APPROVED, returns success with emailStatus "already_sent"
// - Email sent asynchronously (fire-and-forget) to not block approval response
// - Rate limit (429) handled gracefully - approval still succeeds
// - Returns structured response: { approvalStatus, emailStatus, message }
// ---------------------------------------------------------------------------
router.post(
  '/admin/users/:id/approve',
  verifySupabaseUser,
  async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    try {
      const admin = req.user!;
      if (!admin.isAdmin) {
        return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
      }

      const { id } = req.params;

      // Atomic check-and-update: only transition PENDING -> APPROVED
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      if (target.isAdmin) {
        return res.status(400).json({ success: false, error: 'Admin accounts do not need manual approval.' });
      }

      // Check current approval status for idempotency
      if (target.approvalStatus === 'APPROVED') {
        // Already approved - return success with email status
        console.log(`[Approve] User ${target.email} already APPROVED (idempotent)`);
        return res.json({
          success: true,
          data: {
            approvalStatus: 'APPROVED',
            emailStatus: 'already_sent',
            user: { id: target.id, email: target.email, name: target.name }
          },
          message: `${target.name} is already approved. No action needed.`
        });
      }

      if (target.approvalStatus === 'REJECTED') {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot approve a rejected user. Please contact support.' 
        });
      }

      // Atomically update: PENDING -> APPROVED
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          approvalStatus: 'APPROVED',
          approvalReviewedAt: new Date(),
          approvalReviewedBy: admin.id,
          rejectionReason: null
        }
      });

      const approvalDuration = Date.now() - startTime;
      console.log(`[Approve] User ${target.email} approved in ${approvalDuration}ms`);

      // Send magic link asynchronously (fire-and-forget)
      // This doesn't block the approval response
      const sendMagicLink = async () => {
        try {
          const client = (supabaseAdmin as any) || (require('../config/supabaseClient').supabase as any);
          const redirectTo = `${FRONTEND_URL}${CALLBACK_PATH}`;
          const { error: sbErr } = await client.auth.signInWithOtp({
            email: target.email,
            options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
          });

          if (sbErr) {
            console.error(`[Approve] Supabase send OTP failed for ${target.email}:`, sbErr);
            
            // Handle rate limit specifically
            if (sbErr.message?.includes('rate limit') || sbErr.message?.includes('429') || sbErr.message?.includes('over_email_send_rate_limit')) {
              console.warn(`[Approve] Rate limited sending magic link to ${target.email}. Admin can resend later.`);
              // Could emit event for admin notification here
              return;
            }
            console.error(`[Approve] Failed to send magic link to ${target.email}:`, sbErr.message);
          } else {
            console.log(`[Approve] Magic link sent successfully to ${target.email}`);
          }
        } catch (err) {
          console.error(`[Approve] Unexpected error sending magic link to ${target.email}:`, err);
        }
      };

      // Fire and forget - don't await
      sendMagicLink();

      res.json({
        success: true,
        data: {
          approvalStatus: 'APPROVED',
          emailStatus: 'sending', // Will be "sent" or "rate_limited" or "failed" - async
          user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name }
        },
        message: `${target.name} has been approved. Sign-in link is being sent to ${target.email}.`
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
// - Idempotent: if already deleted/rejected, returns success
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
      if (!target) {
        // Idempotent: already deleted
        return res.json({
          success: true,
          message: 'User already deleted or does not exist.'
        });
      }
      if (target.isAdmin) {
        return res.status(400).json({ success: false, error: 'Admin accounts cannot be rejected via this workflow.' });
      }
      if (target.approvalStatus !== 'PENDING') {
        // Idempotent: already processed
        return res.json({
          success: true,
          message: `User ${target.name} is already ${target.approvalStatus.toLowerCase()}. No action needed.`
        });
      }

      // 1) Delete from Supabase Auth first
      let sbUserIdToDelete = target.supabaseUserId;

      if (!sbUserIdToDelete) {
        // Try to find the Supabase user ID by email if not stored in our DB
        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (!listErr && users) {
          const sbUser = (users as any[]).find(u => u.email === target.email);
          if (sbUser) {
            sbUserIdToDelete = sbUser.id;
          }
        }
      }

      if (sbUserIdToDelete) {
        const { error: sbErr } = await supabaseAdmin.auth.admin.deleteUser(sbUserIdToDelete);
        if (sbErr) {
          console.error(`Failed to delete Supabase user ${sbUserIdToDelete}:`, sbErr);
          return res.status(502).json({
            success: false,
            error: `Failed to delete Supabase account: ${sbErr.message}. Please try again.`
          });
        }
      } else {
        console.warn(`No Supabase Auth account found for ${target.email}. Proceeding to delete application record.`);
      }

      // 2) Delete from application DB only after successful Supabase deletion (or if no SB user existed)
      await prisma.user.delete({
        where: { id }
      });

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
