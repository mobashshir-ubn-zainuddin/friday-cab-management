import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';
import { createOrder, verifyPaymentSignature } from '../utils/razorpay';

const router = Router();

// Validation schemas
const createPaymentSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID')
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string()
});

// Get user's payments
router.get('/my-payments', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, page = '1', limit = '10' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      userId: req.user!.id
    };

    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          trip: {
            select: {
              id: true,
              title: true,
              date: true,
              departureTime: true
            }
          },
          booking: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
});

// Get single payment
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        userId: req.user!.id
      },
      include: {
        trip: true,
        booking: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment'
    });
  }
});

// Create payment order (Razorpay)
router.post('/create-order', authenticate, validateBody(createPaymentSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.body;
    const userId = req.user!.id;

    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        userId,
        tripId,
        status: 'PENDING'
      },
      include: {
        trip: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found or already completed'
      });
    }

    // Check if payment window is open
    if (!payment.trip.paymentWindowOpen) {
      return res.status(400).json({
        success: false,
        error: 'Payment window is closed'
      });
    }

    // Create Razorpay order
    const order = await createOrder(
      payment.amount,
      payment.id.substring(0, 30), // Shorten receipt ID to max 40 chars
      {
        paymentId: payment.id,
        userId,
        tripId
      }
    );

    // Update payment with order ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayOrderId: order.id,
        status: 'PROCESSING'
      }
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment order'
    });
  }
});

// Verify and complete payment
router.post('/verify', authenticate, validateBody(verifyPaymentSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Verify signature
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Find and update payment
    const payment = await prisma.payment.findFirst({
      where: {
        razorpayOrderId
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date()
      }
    });

    res.json({
      success: true,
      data: updatedPayment,
      message: 'Payment completed successfully'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Get all payments (admin only)
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user!.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { status, tripId, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (tripId) {
      where.tripId = tripId;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              rollNumber: true
            }
          },
          trip: {
            select: {
              id: true,
              title: true,
              date: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
});

// Export payment report (admin only)
router.get('/report/export', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user!.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { tripId, status } = req.query;

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (tripId) {
      where.tripId = tripId;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            rollNumber: true
          }
        },
        trip: {
          select: {
            title: true,
            date: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format for CSV export
    const report = payments.map(p => ({
      'Payment ID': p.id,
      'Student Name': p.user.name,
      'Email': p.user.email,
      'Roll Number': p.user.rollNumber,
      'Trip': p.trip.title,
      'Trip Date': p.trip.date,
      'Amount': p.amount,
      'Status': p.status,
      'Paid At': p.paidAt,
      'Razorpay Payment ID': p.razorpayPaymentId
    }));

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error exporting payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export payments'
    });
  }
});

export default router;
