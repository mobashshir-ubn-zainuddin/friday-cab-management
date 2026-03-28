import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, checkPendingPayments, checkBlockedStatus } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';
import { sendBookingConfirmation } from '../utils/email';

const router = Router();

// Validation schemas
const createBookingSchema = z.object({
  tripId: z.string().uuid('Invalid trip ID')
});

// Get user's bookings
router.get('/my-bookings', authenticate, async (req: AuthenticatedRequest, res) => {
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
            select: {
              id: true,
              title: true,
              date: true,
              departureTime: true,
              returnTime: true,
              status: true,
              totalCost: true,
              costPerPerson: true,
              paymentWindowOpen: true
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

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
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

    res.json({
      success: true,
      data: booking
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
router.post('/', authenticate, checkBlockedStatus, checkPendingPayments, validateBody(createBookingSchema), async (req: AuthenticatedRequest, res) => {
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

    // Check booking window
    const now = new Date();
    if (now < trip.bookingStartTime || now > trip.bookingEndTime) {
      return res.status(400).json({
        success: false,
        error: 'Booking window is closed'
      });
    }

    if (trip.status !== 'BOOKING_OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Booking is not open for this trip'
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

    // Create or reactivate booking
    let booking;
    if (existingBooking) {
      booking = await prisma.booking.update({
        where: { id: existingBooking.id },
        data: {
          status: 'CONFIRMED',
          cancelledAt: null
        },
        include: {
          trip: true
        }
      });
    } else {
      booking = await prisma.booking.create({
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
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        currentBookings: {
          increment: 1
        }
      }
    });

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });
  } catch (error) {
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

    // Check cancellation deadline
    if (booking.trip.cancellationDeadline && new Date() > booking.trip.cancellationDeadline) {
      return res.status(400).json({
        success: false,
        error: 'Cancellation deadline has passed'
      });
    }

    // Check if trip has already started
    if (new Date() > booking.trip.departureTime) {
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
