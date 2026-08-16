import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest, TripStatus } from '../types';
import {
  sendTripNotification,
  formatEmailDate,
  formatEmailTime,
  formatEmailDateTime
} from '../utils/email';
import {
  APP_TIMEZONE,
  istToUtcDate,
  istDateToUtcMidnight,
  formatDateIST,
  formatLongDateIST,
  formatTimeIST,
  formatDateTimeIST,
  formatForDatetimeLocalIST,
  isInvalidDate
} from '../utils/timezone';
import {
  getEffectiveTripStatus,
  isBookingCurrentlyOpen,
  canUserCancelBooking,
  syncTripStatuses,
  syncSingleTripStatus,
  EffectiveTripStatus
} from '../utils/tripStatus';

const router = Router();

const DATETIME_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseIST = (input: string | undefined | null): Date | null => {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  const naive = DATETIME_INPUT_REGEX.test(s)
    ? s
    : DATE_INPUT_REGEX.test(s)
    ? `${s}T00:00:00`
    : null;
  if (naive) {
    const d = istToUtcDate(naive);
    return isInvalidDate(d) ? null : d;
  }
  const d = new Date(s);
  return isInvalidDate(d) ? null : d;
};

const isIstTimeValid = (val: string): boolean => {
  if (!val) return true;
  const s = val.trim();
  if (!s) return true;
  if (DATETIME_INPUT_REGEX.test(s) || DATE_INPUT_REGEX.test(s)) {
    return !isInvalidDate(istToUtcDate(
      DATETIME_INPUT_REGEX.test(s) ? s : `${s}T00:00:00`
    ));
  }
  return !isNaN(Date.parse(s));
};

const istTimeFieldRefine = (message: string) =>
  z.string().refine((val) => isIstTimeValid(val), { message });

// Validation schemas
const createTripSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  date: z.string().refine((val) => DATE_INPUT_REGEX.test(val) || !isNaN(Date.parse(val)), {
    message: 'Invalid date format (use YYYY-MM-DD)'
  }),
  bookingStartTime: istTimeFieldRefine('Invalid booking start time'),
  bookingEndTime: istTimeFieldRefine('Invalid booking end time'),
  cancellationDeadline: z.string().optional().pipe(z.string().or(z.literal(''))).optional().refine(
    (val) => !val || isIstTimeValid(val),
    { message: 'Invalid cancellation deadline' }
  ),
  departureTime: istTimeFieldRefine('Invalid departure time'),
  returnTime: z.string().optional().pipe(z.string().or(z.literal(''))).optional().refine(
    (val) => !val || isIstTimeValid(val),
    { message: 'Invalid return time' }
  ),
  maxBookings: z.number().int().positive().optional()
}).superRefine((data, ctx) => {
  const bookingStart = parseIST(data.bookingStartTime);
  const bookingEnd = parseIST(data.bookingEndTime);
  const cancel = parseIST(data.cancellationDeadline);
  const depart = parseIST(data.departureTime);
  const returnT = parseIST(data.returnTime);

  if (bookingStart && bookingEnd && bookingStart.getTime() >= bookingEnd.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bookingEndTime'], message: 'Booking end must be after booking start' });
  }
  if (cancel && bookingEnd && cancel.getTime() < bookingEnd.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cancellationDeadline'], message: 'Cancellation deadline must be at or after booking close' });
  }
  if (cancel && depart && cancel.getTime() > depart.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cancellationDeadline'], message: 'Cancellation deadline must be before departure' });
  }
  if (bookingStart && depart && bookingStart.getTime() >= depart.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departureTime'], message: 'Departure must be after booking opens' });
  }
  if (returnT && depart && returnT.getTime() <= depart.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['returnTime'], message: 'Return must be after departure' });
  }
});

const updateTripSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').optional(),
  description: z.string().optional(),
  date: z.string().optional().refine(
    (val) => val === undefined || DATE_INPUT_REGEX.test(val) || !isNaN(Date.parse(val)),
    { message: 'Invalid date format (use YYYY-MM-DD)' }
  ),
  bookingStartTime: z.string().optional().refine(
    (val) => val === undefined || isIstTimeValid(val),
    { message: 'Invalid booking start time' }
  ),
  bookingEndTime: z.string().optional().refine(
    (val) => val === undefined || isIstTimeValid(val),
    { message: 'Invalid booking end time' }
  ),
  cancellationDeadline: z.string().optional().refine(
    (val) => val === undefined || val === '' || val === null || isIstTimeValid(val),
    { message: 'Invalid cancellation deadline' }
  ),
  departureTime: z.string().optional().refine(
    (val) => val === undefined || isIstTimeValid(val),
    { message: 'Invalid departure time' }
  ),
  returnTime: z.string().optional().refine(
    (val) => val === undefined || val === '' || val === null || isIstTimeValid(val),
    { message: 'Invalid return time' }
  ),
  maxBookings: z.number().int().positive().optional()
}).superRefine((data, ctx) => {
  const bookingStart = parseIST(data.bookingStartTime);
  const bookingEnd = parseIST(data.bookingEndTime);
  const cancel = data.cancellationDeadline === '' || data.cancellationDeadline === null ? null : parseIST(data.cancellationDeadline);
  const depart = parseIST(data.departureTime);
  const returnT = data.returnTime === '' || data.returnTime === null ? null : parseIST(data.returnTime);

  if (bookingStart && bookingEnd && bookingStart.getTime() >= bookingEnd.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bookingEndTime'], message: 'Booking end must be after booking start' });
  }
  if (cancel && bookingEnd && cancel.getTime() < bookingEnd.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cancellationDeadline'], message: 'Cancellation deadline must be at or after booking close' });
  }
  if (cancel && depart && cancel.getTime() > depart.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cancellationDeadline'], message: 'Cancellation deadline must be before departure' });
  }
  if (bookingStart && depart && bookingStart.getTime() >= depart.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departureTime'], message: 'Departure must be after booking opens' });
  }
  if (returnT && depart && returnT.getTime() <= depart.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['returnTime'], message: 'Return must be after departure' });
  }
});

// Get all trips (with filters)
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  const requestId = (req as any).requestId || 'unknown';
  const overallStart = process.hrtime.bigint();
  
  try {
    // Sync trip statuses before querying to ensure database status is up-to-date
    await syncTripStatuses(prisma);

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
    
    // Filter by stored status if provided (for backward compatibility)
    if (status) {
      where.status = status as TripStatus;
    }
    
    if (upcoming === 'true') {
      // Show trips where booking window is currently open OR departure is in the future
      // departureTime is stored as correct UTC instant; Date.now() is also UTC absolute — so this is correct.
      where.OR = [
        { status: 'BOOKING_OPEN' },
        { departureTime: { gte: new Date() } }
      ];
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

    // Time the count query
    const countStart = process.hrtime.bigint();
    const total = await prisma.trip.count({ where });
    const countMs = Number(process.hrtime.bigint() - countStart) / 1_000_000;

    // Time the findMany query - include cabs with currentOccupancy for effective status calculation
    const findStart = process.hrtime.bigint();
    const trips = await prisma.trip.findMany({
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
    });
    const findMs = Number(process.hrtime.bigint() - findStart) / 1_000_000;

    const now = new Date();
    // Add user booking status and effective status to each trip
    // Now that we've synced, effectiveStatus should match the persisted status for non-cancelled trips
    const tripsWithBookingStatus = trips.map(trip => ({
      ...trip,
      userBooking: trip.bookings.length > 0 ? trip.bookings[0] : null,
      effectiveStatus: getEffectiveTripStatus(trip, now),
      bookings: undefined
    }));

    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    
    // Log detailed timing for slow requests
    if (totalMs > 500 || countMs > 200 || findMs > 300) {
      console.log(`[Trip GET /] Request ${requestId} - Total: ${totalMs.toFixed(2)}ms, Count: ${countMs.toFixed(2)}ms, FindMany: ${findMs.toFixed(2)}ms, Trips: ${trips.length}, Page: ${pageNum}, Limit: ${limitNum}`);
    }

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
    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    console.error(`[Trip GET /] Request ${requestId} failed after ${totalMs.toFixed(2)}ms:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trips'
    });
  }
});

// Get single trip
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  const requestId = (req as any).requestId || 'unknown';
  const overallStart = process.hrtime.bigint();
  
  try {
    const { id } = req.params;
    const isAdmin = req.user!.isAdmin;

    // Sync this specific trip's status before fetching
    await syncSingleTripStatus(prisma, id);

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
                rollNumber: true,
                department: true,
                phone: true
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
                    rollNumber: true,
                    department: true,
                    phone: true
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

    // Filter bookings if not admin
    let bookings = trip.bookings;
    if (!isAdmin) {
      bookings = trip.bookings.filter(b => b.userId === req.user!.id);
    }

    // Check if user has booked this trip
    const userBooking = trip.bookings.find(b => b.userId === req.user!.id);

    const now = new Date();
    const effectiveStatus = getEffectiveTripStatus(trip, now);

    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    if (totalMs > 500) {
      console.log(`[Trip GET /:id] Request ${requestId} - Total: ${totalMs.toFixed(2)}ms, Trip: ${id}`);
    }

    res.json({
      success: true,
      data: {
        ...trip,
        bookings,
        userBooking: userBooking || null,
        effectiveStatus
      }
    });
  } catch (error) {
    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    console.error(`[Trip GET /:id] Request ${requestId} failed after ${totalMs.toFixed(2)}ms:`, error);
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

    const dateOnly = typeof date === 'string' && DATE_INPUT_REGEX.test(date.trim()) ? date.trim() : null;
    const dateUtc = dateOnly
      ? istDateToUtcMidnight(dateOnly)
      : (date ? parseIST(date) : null) as any;

    const bookingStartUtc = parseIST(bookingStartTime) as Date;
    const bookingEndUtc = parseIST(bookingEndTime) as Date;
    const cancelUtc = cancellationDeadline ? parseIST(cancellationDeadline) : null;
    const departUtc = parseIST(departureTime) as Date;
    const returnUtc = returnTime ? parseIST(returnTime) : null;

    const trip = await prisma.trip.create({
      data: {
        title,
        description,
        date: dateUtc ?? undefined,
        bookingStartTime: bookingStartUtc,
        bookingEndTime: bookingEndUtc,
        cancellationDeadline: cancelUtc,
        departureTime: departUtc,
        returnTime: returnUtc,
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
        date: formatEmailDate(trip.date),
        departureTime: formatEmailTime(trip.departureTime),
        bookingStartTime: formatEmailDateTime(trip.bookingStartTime),
        bookingEndTime: formatEmailDateTime(trip.bookingEndTime)
      })
    );

    // Don't wait for emails to send
    Promise.allSettled(emailPromises).then(results => {
      const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;
      const errors = results.filter(r => r.status === 'rejected').length;
      console.log(`Trip notification emails: ${sent} sent, ${failed} failed, ${errors} errors`);
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

    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.maxBookings !== undefined) updateData.maxBookings = req.body.maxBookings;

    if (req.body.date !== undefined) {
      const d: any = req.body.date;
      if (d && typeof d === 'string') {
        const trimmed = d.trim();
        const dateOnly = DATE_INPUT_REGEX.test(trimmed);
        updateData.date = dateOnly ? istDateToUtcMidnight(trimmed) : parseIST(trimmed);
      } else if (!d) {
        updateData.date = null;
      }
    }

    const timeFields = ['bookingStartTime', 'bookingEndTime', 'cancellationDeadline', 'departureTime', 'returnTime'];
    for (const f of timeFields) {
      if (req.body[f] === undefined) continue;
      const raw: any = req.body[f];
      if (raw === '' || raw === null) {
        updateData[f] = null;
      } else if (typeof raw === 'string') {
        const parsed = parseIST(raw.trim());
        if (parsed) updateData[f] = parsed;
      }
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: updatedTrip,
      message: 'Trip updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating trip:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update trip'
    });
  }
});

// Cancel trip (admin only)
router.patch('/:id/cancel', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { status: 'CONFIRMED' }
        }
      }
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    if (trip.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Trip is already cancelled'
      });
    }

    // Cancel all confirmed bookings for this trip
    if (trip.bookings.length > 0) {
      await prisma.booking.updateMany({
        where: {
          tripId: id,
          status: 'CONFIRMED'
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      });

      // Update trip booking count
      await prisma.trip.update({
        where: { id },
        data: {
          currentBookings: 0
        }
      });
    }

    // Update trip status to CANCELLED
    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({
      success: true,
      data: updatedTrip,
      message: 'Trip cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling trip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel trip'
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

    // Sync trip status first to ensure we have the latest status
    await syncSingleTripStatus(prisma, id);

    // Get all eligible bookings for this trip (CONFIRMED or ATTENDED, not CANCELLED/NO_SHOW)
    const eligibleBookings = await prisma.booking.findMany({
      where: {
        tripId: id,
        status: { in: ['CONFIRMED', 'ATTENDED'] }
      }
    });

    const trip = await prisma.trip.findUnique({
      where: { id }
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    // If opening payment window without totalCost, just toggle the window
    // Admin can enter totalCost later
    let updateData: any = {
      paymentWindowOpen: action === 'open'
    };

    // If opening payment window with totalCost, calculate cost per person and create payment records
    if (action === 'open' && totalCost) {
      if (eligibleBookings.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No eligible bookings found for this trip'
        });
      }

      const costPerPerson = totalCost / eligibleBookings.length;
      updateData.totalCost = totalCost;
      updateData.costPerPerson = costPerPerson;
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: updateData
    });

    // If opening payment window with totalCost, create payment records for all eligible bookings
    if (action === 'open' && totalCost) {
      await prisma.payment.createMany({
        data: eligibleBookings.map(booking => ({
          userId: booking.userId,
          tripId: id,
          bookingId: booking.id,
          amount: updateData.costPerPerson,
          status: 'PENDING'
        })),
        skipDuplicates: true
      });
    }

    // If closing payment window, we might want to clean up PENDING payments that were never paid
    // But for now, we just close the window - payments remain for tracking

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
  const { id } = req.params;
  try {

    await prisma.trip.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });
  } catch (error: any) {
    // Handle Prisma P2025 "Record to delete does not exist" as idempotent success
    if (error.code === 'P2025') {
      console.log(`[Trip DELETE] Trip ${id} already deleted (idempotent)`);
      return res.json({
        success: true,
        message: 'Trip already deleted'
      });
    }
    console.error('Error deleting trip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trip'
    });
  }
});

export default router;
