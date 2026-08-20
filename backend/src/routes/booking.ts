import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, checkPendingPayments, checkBlockedStatus } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';
import { sendBookingConfirmation } from '../utils/email';
import { isBookingCurrentlyOpen, canUserCancelBooking, getEffectiveTripStatus } from '../utils/tripStatus';

const router = Router();

// Validation schemas
const createBookingSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID')
});

// Get user's bookings
router.get('/my-bookings', authenticate, async (req: AuthenticatedRequest, res) => {
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

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          trip: {
            include: {
              cabs: {
                select: {
                  currentOccupancy: true
                }
              }
            }
          },
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              paidAt: true
            }
          },
          cabAssignment: {
            include: {
              cab: {
                select: {
                  vehicleType: true,
                  vehicleNumber: true,
                  driverName: true,
                  driverPhone: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.booking.count({ where })
    ]);

    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    if (totalMs > 500) {
      console.log(`[Booking GET /my-bookings] Request ${requestId} - Total: ${totalMs.toFixed(2)}ms`);
    }

    const now = new Date();
    const bookingsWithEffectiveStatus = bookings.map(booking => ({
      ...booking,
      trip: {
        ...booking.trip,
        effectiveStatus: getEffectiveTripStatus(booking.trip, now)
      }
    }));

    res.json({
      success: true,
      data: {
        bookings: bookingsWithEffectiveStatus,
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
    console.error(`[Booking GET /my-bookings] Request ${requestId} failed after ${totalMs.toFixed(2)}ms:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// Get single booking
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        userId: req.user!.id
      },
      include: {
        trip: {
          include: {
            cabs: {
              include: {
                assignments: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        rollNumber: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        payment: true,
        cabAssignment: {
          include: {
            cab: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const now = new Date();
    const bookingWithEffectiveStatus = {
      ...booking,
      trip: {
        ...booking.trip,
        effectiveStatus: getEffectiveTripStatus(booking.trip, now)
      }
    };

    res.json({
      success: true,
      data: bookingWithEffectiveStatus
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking'
    });
  }
});

// Create booking
router.post('/', authenticate, checkBlockedStatus, validateBody(createBookingSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.body;
    const userId = req.user!.id;

    // Check if trip exists and is open for booking
    const trip = await prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    // Check booking window using time-based logic (not status field)
    const now = new Date();
    if (!isBookingCurrentlyOpen(trip, now)) {
      if (now < trip.bookingStartTime) {
        return res.status(400).json({
          success: false,
          error: 'Booking has not started yet'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Booking window has closed'
      });
    }

    // Check if trip is cancelled
    if (trip.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot book a cancelled trip'
      });
    }

    // Check if already booked
    const existingBooking = await prisma.booking.findUnique({
      where: {
        userId_tripId: {
          userId,
          tripId
        }
      }
    });

    if (existingBooking && existingBooking.status !== 'CANCELLED') {
      return res.status(409).json({
        success: false,
        error: 'You have already booked this trip'
      });
    }

    // Check if max bookings reached
    if (trip.currentBookings >= trip.maxBookings) {
      return res.status(400).json({
        success: false,
        error: 'Maximum bookings reached for this trip'
      });
    }

    // Use a transaction to atomically check pending payments AND create booking
    // This prevents race conditions where a user could bypass the pending payment check
    const result = await prisma.$transaction(async (tx) => {
      // Re-check pending payments inside transaction (atomic with booking creation)
      const pendingPayments = await tx.payment.count({
        where: {
          userId,
          status: { in: ['PENDING', 'PROCESSING', 'FAILED'] }
        }
      });

      if (pendingPayments > 0) {
        // Throw an error that will be caught and returned as 409
        throw new Error('PENDING_PAYMENT');
      }

      // Re-check trip booking count inside transaction (atomic)
      const currentTrip = await tx.trip.findUnique({
        where: { id: tripId },
        select: { currentBookings: true, maxBookings: true }
      });

      if (!currentTrip || currentTrip.currentBookings >= currentTrip.maxBookings) {
        throw new Error('MAX_BOOKINGS_REACHED');
      }

      // Check if already booked (inside transaction for consistency)
      const existing = await tx.booking.findUnique({
        where: {
          userId_tripId: {
            userId,
            tripId
          }
        }
      });

      if (existing && existing.status !== 'CANCELLED') {
        throw new Error('ALREADY_BOOKED');
      }

      // Create or reactivate booking
      let booking;
      if (existing) {
        booking = await tx.booking.update({
          where: { id: existing.id },
          data: {
            status: 'CONFIRMED',
            cancelledAt: null
          },
          include: {
            trip: true
          }
        });
      } else {
        booking = await tx.booking.create({
          data: {
            userId,
            tripId,
            status: 'CONFIRMED'
          },
          include: {
            trip: true
          }
        });
      }

      // Update trip booking count
      await tx.trip.update({
        where: { id: tripId },
        data: {
          currentBookings: {
            increment: 1
          }
        }
      });

      return booking;
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Booking created successfully'
    });
  } catch (error: any) {
    if (error.message === 'PENDING_PAYMENT') {
      return res.status(409).json({
        success: false,
        error: 'You have a pending payment from a previous trip. Please complete it before booking another trip.',
        code: 'PENDING_PAYMENT'
      });
    }
    if (error.message === 'MAX_BOOKINGS_REACHED') {
      return res.status(400).json({
        success: false,
        error: 'Maximum bookings reached for this trip'
      });
    }
    if (error.message === 'ALREADY_BOOKED') {
      return res.status(409).json({
        success: false,
        error: 'You have already booked this trip'
      });
    }
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

// Cancel booking
router.patch('/:id/cancel', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        userId
      },
      include: {
        trip: true
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Booking is already cancelled'
      });
    }

    // Check if trip is cancelled
    if (booking.trip.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel booking for a cancelled trip'
      });
    }

    // Check if user can cancel (uses cancellationDeadline and departureTime)
    const now = new Date();
    if (!canUserCancelBooking(booking.trip, now)) {
      if (booking.trip.cancellationDeadline && now > booking.trip.cancellationDeadline) {
        return res.status(400).json({
          success: false,
          error: 'Cancellation deadline has passed'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel after trip departure'
      });
    }

    // Cancel booking
    await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    // Update trip booking count
    await prisma.trip.update({
      where: { id: booking.tripId },
      data: {
        currentBookings: {
          decrement: 1
        }
      }
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

// Mark attendance (admin only)
router.patch('/:id/attendance', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { attended } = req.body;

    if (!req.user!.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { trip: true }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        attended,
        status: attended ? 'ATTENDED' : 'NO_SHOW'
      }
    });

    res.json({
      success: true,
      data: updatedBooking,
      message: `Attendance marked as ${attended ? 'present' : 'absent'}`
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
  }
});

// Bulk mark attendance (admin only)
router.post('/bulk-attendance', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId, attended } = req.body;

    if (!req.user!.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Update all bookings for the trip
    await prisma.booking.updateMany({
      where: {
        tripId,
        status: 'CONFIRMED'
      },
      data: {
        attended,
        status: attended ? 'ATTENDED' : 'NO_SHOW'
      }
    });

    res.json({
      success: true,
      message: `Attendance marked for all bookings`
    });
  } catch (error) {
    console.error('Error marking bulk attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
  }
});

export default router;
