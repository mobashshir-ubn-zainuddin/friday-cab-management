import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { supabase } from '../config/supabaseClient';

// Authenticate user with Supabase Token
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access denied. Invalid token format.'
      });
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token.'
      });
      return;
    }

    const email = user.email;

    // 🔒 HARD SECURITY CHECK: Only allow @kgpian.iitkgp.ac.in
    if (!email?.endsWith('@kgpian.iitkgp.ac.in')) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized domain. Only @kgpian.iitkgp.ac.in emails are allowed.'
      });
      return;
    }

    // Check if user exists in our DB
    let dbUser = await prisma.user.findUnique({
      where: { email: email }
    });

    if (!dbUser) {
      // Create new user if not exists
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
      const isAdmin = adminEmails.includes(email.toLowerCase());

      dbUser = await prisma.user.create({
        data: {
          email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          isAdmin,
          isBlocked: false
        }
      });
    }

    if (dbUser.isBlocked) {
      res.status(403).json({
        success: false,
        error: 'Your account has been blocked.'
      });
      return;
    }

    req.user = dbUser;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed.'
    });
  }
};

// Check if user has pending payments
export const checkPendingPayments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const pendingPayments = await prisma.payment.count({
      where: {
        userId: req.user.id,
        status: { in: ['PENDING', 'FAILED'] }
      }
    });

    if (pendingPayments > 0) {
      res.status(403).json({
        success: false,
        error: 'You have pending payments. Please clear them before proceeding.',
        code: 'PENDING_PAYMENTS'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking pending payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status'
    });
  }
};

// Check if user is blocked
export const checkBlockedStatus = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && req.user.isBlocked) {
    res.status(403).json({
      success: false,
      error: 'Your account has been blocked. Please contact support.',
      code: 'USER_BLOCKED'
    });
    return;
  }
  next();
};

// Authorize admin only
export const authorizeAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !req.user.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
    return;
  }
  next();
};

// Optional authentication
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      next();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser(token);

    if (user && user.email?.endsWith('@kgpian.iitkgp.ac.in')) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email }
      });
      if (dbUser) {
        req.user = dbUser;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

export default { authenticate, authorizeAdmin, optionalAuth, checkPendingPayments, checkBlockedStatus };
