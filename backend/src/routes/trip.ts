import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest, TripStatus } from '../types';
import { sendTripNotification } from '../utils/email';

const router = Router();

// Validation schemas
const createTripSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  bookingStartTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid booking start time" }),
  bookingEndTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid booking end time" }),
  cancellationDeadline: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: "Invalid cancellation deadline" }),
  departureTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid departure time" }),
  returnTime: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: "Invalid return time" }),
  maxBookings: z.number().int().positive().optional()
});

const updateTripSchema = createTripSchema.partial();

// Get all trips (with filters)
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      status, 
      upcoming, 
      page = '1', 
      limit = '10',
      myBookings 
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    if (status) {
      where.status = status as TripStatus;
    }
    
    if (upcoming === 'true') {
      where.date = { gte: new Date() };
    }

    // If myBookings is true, only show trips the user has booked
    if (myBookings === 'true') {
      where.bookings = {
        some: {
          userId: req.user!.id,
          status: { not: 'CANCELLED' }
        }
      };
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          _count: {
            select: { bookings: true }
          },
          bookings: {
            where: { userId: req.user!.id },
            select: { id: true, status: true }
          },
          cabs: {
            select: {
              id: true,
              vehicleType: true,
              vehicleNumber: true,
              maxCapacity: true,
              currentOccupancy: true
            }
          }
        },
        orderBy: { date: 'asc' },
        skip,
        take: limitNum
      }),
      prisma.trip.count({ where })
    ]);

    // Add user booking status to each trip
    const tripsWithBookingStatus = trips.map(trip => ({
      ...trip,
      userBooking: trip.bookings.length > 0 ? trip.bookings[0] : null,
      bookings: undefined
    }));

    res.json({
      success: true,
      data: {
        trips: tripsWithBookingStatus,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trips'
    });
  }
});

// Get single trip
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { 
            status: { not: 'CANCELLED' }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                rollNumber: true
              }
            },
            cabAssignment: {
              include: {
                cab: true
              }
            }
          }
        },
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
        },
        payments: {
          where: { userId: req.user!.id },
          select: {
            id: true,
            amount: true,
            status: true
          }
        }
      }
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    // Check if user has booked this trip
    const userBooking = trip.bookings.find(b => b.userId === req.user!.id);

    res.json({
      success: true,
      data: {
        ...trip,
        userBooking: userBooking || null
      }
    });
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trip'
    });
  }
});

// Create trip (admin only)
router.post('/', authenticate, authorizeAdmin, validateBody(createTripSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      title,
      description,
      date,
      bookingStartTime,
      bookingEndTime,
      cancellationDeadline,
      departureTime,
      returnTime,
      maxBookings
    } = req.body;

    const trip = await prisma.trip.create({
      data: {
        title,
        description,
        date: new Date(date),
        bookingStartTime: new Date(bookingStartTime),
        bookingEndTime: new Date(bookingEndTime),
        cancellationDeadline: cancellationDeadline ? new Date(cancellationDeadline) : null,
        departureTime: new Date(departureTime),
        returnTime: returnTime ? new Date(returnTime) : null,
        maxBookings: maxBookings || 100,
        status: 'UPCOMING',
        createdBy: req.user!.id
      }
    });

    // Send email notification to all users
    const users = await prisma.user.findMany({
      where: { isBlocked: false },
      select: { email: true }
    });

    const emailPromises = users.map(user => 
      sendTripNotification(user.email, {
        title: trip.title,
        date: new Date(trip.date).toLocaleDateString('en-IN'),
        departureTime: new Date(trip.departureTime).toLocaleTimeString('en-IN'),
        bookingStartTime: new Date(trip.bookingStartTime).toLocaleString('en-IN'),
        bookingEndTime: new Date(trip.bookingEndTime).toLocaleString('en-IN')
      })
    );

    // Don't wait for emails to send
    Promise.allSettled(emailPromises).then(results => {
      const sent = results.filter(r => r.status === 'fulfilled').length;
      console.log(`Trip notification emails sent to ${sent} users`);
    });

    res.status(201).json({
      success: true,
      data: trip,
      message: 'Trip created successfully'
    });
  } catch (error: any) {
    console.error('Error creating trip:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create trip'
    });
  }
});

// Update trip (admin only)
router.patch('/:id', authenticate, authorizeAdmin, validateBody(updateTripSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData: any = {};

    // Only allow updating certain fields based on trip status
    const trip = await prisma.trip.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    const fields = ['title', 'description', 'date', 'bookingStartTime', 'bookingEndTime', 
                    'cancellationDeadline', 'departureTime', 'returnTime', 'maxBookings'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field.includes('Time') || field === 'date' || field === 'cancellationDeadline') {
          // Only create Date if value is provided and valid
          if (req.body[field]) {
            const parsedDate = new Date(req.body[field]);
            if (!isNaN(parsedDate.getTime())) {
              updateData[field] = parsedDate;
            }
          } else {
            updateData[field] = null;
          }
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: updatedTrip,
      message: 'Trip updated successfully'
    });
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trip'
    });
  }
});

// Update trip status (admin only)
router.patch('/:id/status', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(TripStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: { status }
    });

    res.json({
      success: true,
      data: updatedTrip,
      message: 'Trip status updated successfully'
    });
  } catch (error) {
    console.error('Error updating trip status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trip status'
    });
  }
});

// Open/close booking window (admin only)
router.patch('/:id/booking-window', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'open' or 'close'

    if (!action || !['open', 'close'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "open" or "close"'
      });
    }

    const newStatus = action === 'open' ? 'BOOKING_OPEN' : 'BOOKING_CLOSED';

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: { status: newStatus }
    });

    res.json({
      success: true,
      data: updatedTrip,
      message: `Booking window ${action}ed successfully`
    });
  } catch (error) {
    console.error('Error updating booking window:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking window'
    });
  }
});

// Open payment window (admin only)
router.patch('/:id/payment-window', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { action, totalCost } = req.body; // 'open' or 'close'

    if (!action || !['open', 'close'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "open" or "close"'
      });
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        bookings: {
          where: {
            status: { in: ['CONFIRMED', 'ATTENDED'] },
            attended: true
          }
        }
      }
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    let updateData: any = {
      paymentWindowOpen: action === 'open'
    };

    // If opening payment window, calculate cost per person
    if (action === 'open' && totalCost) {
      const attendedBookings = trip.bookings.filter(b => b.attended).length;
      
      if (attendedBookings === 0) {
        return res.status(400).json({
          success: false,
          error: 'No attendees found for this trip'
        });
      }

      const costPerPerson = totalCost / attendedBookings;
      updateData.totalCost = totalCost;
      updateData.costPerPerson = costPerPerson;
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: updateData
    });

    // If opening payment window, create payment records
    if (action === 'open' && totalCost) {
      const attendedBookings = trip.bookings.filter(b => b.attended);
      
      await prisma.payment.createMany({
        data: attendedBookings.map(booking => ({
          userId: booking.userId,
          tripId: id,
          bookingId: booking.id,
          amount: updateData.costPerPerson,
          status: 'PENDING'
        })),
        skipDuplicates: true
      });
    }

    res.json({
      success: true,
      data: updatedTrip,
      message: `Payment window ${action}ed successfully`
    });
  } catch (error) {
    console.error('Error updating payment window:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment window'
    });
  }
});

// Delete trip (admin only)
router.delete('/:id', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.trip.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trip'
    });
  }
});

export default router;
