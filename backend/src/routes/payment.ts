import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';
import { createOrder, verifyPaymentSignature, fetchPayment, fetchOrder, fetchOrderPayments } from '../utils/razorpay';

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

const resetPaymentSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID')
});

const checkPaymentStatusSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID')
});

// Get user's payments
router.get('/my-payments', authenticate, async (req: AuthenticatedRequest, res) => {
  const requestId = (req as any).requestId || 'unknown';
  const overallStart = process.hrtime.bigint();
  
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

    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    if (totalMs > 500) {
      console.log(`[Payment GET /my-payments] Request ${requestId} - Total: ${totalMs.toFixed(2)}ms`);
    }

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
    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    console.error(`[Payment GET /my-payments] Request ${requestId} failed after ${totalMs.toFixed(2)}ms:`, error);
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

    // Find the payment record - check both PENDING and PROCESSING statuses
    // PROCESSING means a Razorpay order was created but payment wasn't completed (user cancelled checkout)
    const payment = await prisma.payment.findFirst({
      where: {
        userId,
        tripId,
        status: { in: ['PENDING', 'PROCESSING'] }
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

    let orderId = payment.razorpayOrderId;

    // If payment is in PROCESSING but has no order ID, or if we want to create a fresh order
    // Create a new Razorpay order if no existing order ID
    if (!orderId) {
      const order = await createOrder(
        payment.amount,
        payment.id.substring(0, 30), // Shorten receipt ID to max 40 chars
        {
          paymentId: payment.id,
          userId,
          tripId
        }
      );
      orderId = order.id;

      // Update payment with order ID
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayOrderId: orderId,
          status: 'PROCESSING'
        }
      });
    } else {
      // Reuse existing order - just ensure status is PROCESSING
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PROCESSING'
        }
      });
    }

    res.json({
      success: true,
      data: {
        orderId,
        amount: Math.round(payment.amount * 100), // Return amount in paise for frontend
        currency: 'INR',
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
    const userId = req.user!.id;

    // Verify signature
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Find payment by razorpayOrderId
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

    // Security: Verify the payment belongs to the authenticated user
    if (payment.userId !== userId) {
      console.warn(`[Payment Verify] User ${userId} attempted to verify payment ${payment.id} belonging to user ${payment.userId}`);
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to verify this payment'
      });
    }

    // If already completed, return success (idempotent)
    if (payment.status === 'COMPLETED') {
      return res.json({
        success: true,
        data: payment,
        message: 'Payment already completed'
      });
    }

    // Security: Verify payment amount with Razorpay API (server-side)
    // This prevents price tampering — an attacker can't pay ₹1 for a ₹500 order
    try {
      const razorpayPayment = await fetchPayment(razorpayPaymentId);
      const expectedAmountPaise = Math.round(payment.amount * 100);
      const actualAmountPaise = Number(razorpayPayment.amount);

      if (actualAmountPaise !== expectedAmountPaise) {
        console.error(`[Payment Verify] Amount mismatch for payment ${payment.id}: expected ${expectedAmountPaise} paise, got ${actualAmountPaise} paise`);
        return res.status(400).json({
          success: false,
          error: 'Payment amount mismatch. Contact support.'
        });
      }

      // Also verify the payment status on Razorpay's side
      if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
        console.warn(`[Payment Verify] Razorpay payment ${razorpayPaymentId} status is '${razorpayPayment.status}', not captured/authorized`);
        return res.status(400).json({
          success: false,
          error: `Payment not yet captured on Razorpay (status: ${razorpayPayment.status})`
        });
      }
    } catch (fetchError) {
      // If we can't reach Razorpay API, still accept if signature is valid
      // The signature verification is cryptographically secure
      console.warn('[Payment Verify] Could not fetch payment from Razorpay API for amount verification, proceeding with signature-only verification:', fetchError);
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

// Check payment status (for polling)
router.post('/check-status', authenticate, validateBody(checkPaymentStatusSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.body;
    const userId = req.user!.id;

    const payment = await prisma.payment.findFirst({
      where: {
        userId,
        tripId
      },
      include: {
        trip: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // If payment is PROCESSING and has a Razorpay order ID, we could optionally
    // verify with Razorpay API, but for now just return current status
    // The webhook should have already updated it if payment was successful

    res.json({
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status'
    });
  }
});

// Reset payment status from PROCESSING back to PENDING (for cancelled/abandoned checkout)
router.post('/reset', authenticate, validateBody(resetPaymentSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.body;
    const userId = req.user!.id;

    // Find the payment record that's in PROCESSING state
    const payment = await prisma.payment.findFirst({
      where: {
        userId,
        tripId,
        status: 'PROCESSING'
      },
      include: {
        trip: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'No processing payment found to reset'
      });
    }

    // Guard: Check with Razorpay if the order has already been paid
    // This prevents resetting a payment that was actually completed
    // (e.g., user paid via QR but dismissed the modal before handler fired)
    if (payment.razorpayOrderId) {
      try {
        const order = await fetchOrder(payment.razorpayOrderId);

        if (order.status === 'paid') {
          // Order was actually paid! Don't reset — mark as COMPLETED instead
          let capturedPaymentId: string | null = null;
          try {
            const orderPayments = await fetchOrderPayments(payment.razorpayOrderId);
            const captured = (orderPayments.items || orderPayments || []).find(
              (p: any) => p.status === 'captured'
            );
            if (captured) {
              capturedPaymentId = captured.id;
            }
          } catch (fetchErr) {
            console.warn('[reset] Could not fetch order payments:', fetchErr);
          }

          const updatedPayment = await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'COMPLETED',
              ...(capturedPaymentId && { razorpayPaymentId: capturedPaymentId }),
              paidAt: new Date()
            }
          });

          console.log(`[reset] Payment ${payment.id} was already paid on Razorpay — marked as COMPLETED instead of resetting`);

          return res.json({
            success: true,
            data: updatedPayment,
            message: 'Payment was already completed. Status updated.'
          });
        }
      } catch (razorpayError) {
        // If Razorpay API is unreachable, proceed with reset
        // Better to allow retry than to leave in a broken state
        console.warn('[reset] Could not verify order status with Razorpay, proceeding with reset:', razorpayError);
      }
    }

    // Reset payment status back to PENDING and clear razorpayOrderId
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PENDING',
        razorpayOrderId: null
      }
    });

    res.json({
      success: true,
      data: updatedPayment,
      message: 'Payment reset to pending successfully'
    });
  } catch (error) {
    console.error('Error resetting payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset payment'
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
