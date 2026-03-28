import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest, JwtPayload } from '../types';

// Authenticate user with JWT
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

    const decoded = verifyToken(token) as JwtPayload;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found.'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid token.'
    });
  }
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

// Optional authentication (for public routes that can also work with auth)
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

    const decoded = verifyToken(token) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Continue without user
    next();
  }
};

// Check if user is blocked from booking
export const checkBlockedStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
      return;
    }

    // Check if user is blocked
    if (req.user.isBlocked) {
      res.status(403).json({
        success: false,
        error: 'Your account is blocked from booking. Please contact admin.',
        code: 'ACCOUNT_BLOCKED'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking blocked status:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking account status.'
    });
  }
};

// Check if user has ANY unpaid payment - blocks booking if 1 or more unpaid
export const checkPendingPayments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
      return;
    }

    // Check if user has ANY unpaid payment (PENDING or FAILED)
    const unpaidPayment = await prisma.payment.findFirst({
      where: {
        userId: req.user.id,
        status: {
          in: ['PENDING', 'FAILED']
        }
      },
      include: {
        trip: {
          select: {
            id: true,
            title: true,
            date: true
          }
        }
      }
    });

    if (unpaidPayment) {
      res.status(403).json({
        success: false,
        error: `You have an unpaid payment of ₹${unpaidPayment.amount} for "${unpaidPayment.trip?.title || 'Previous Trip'}". Please pay your dues before booking a new trip.`,
        code: 'UNPAID_DUES',
        data: {
          unpaidPayment: {
            id: unpaidPayment.id,
            amount: unpaidPayment.amount,
            trip: unpaidPayment.trip,
            status: unpaidPayment.status
          }
        }
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking pending payments:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking payment status.'
    });
  }
};

export default { authenticate, authorizeAdmin, optionalAuth, checkPendingPayments, checkBlockedStatus };
