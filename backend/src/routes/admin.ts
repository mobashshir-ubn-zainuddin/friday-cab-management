import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { AuthenticatedRequest, VehicleType } from '../types';

const router = Router();

// Validation schemas
const createCabSchema = z.object({
  tripId: z.string().uuid(),
  vehicleType: z.enum(['CAB', 'AUTO', 'TOTO']),
  vehicleNumber: z.string().min(1),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  maxCapacity: z.number().int().positive()
});

const assignCabSchema = z.object({
  cabId: z.string().uuid(),
  bookingId: z.string().uuid()
});

// Get admin dashboard stats
router.get('/dashboard', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalBookings,
      totalRevenue,
      activeTrips,
      pendingPayments,
      todayBookings,
      totalTrips,
      monthlyRevenue
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Total bookings
      prisma.booking.count(),
      
      // Total revenue (completed payments)
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      
      // Active trips (upcoming or in progress)
      prisma.trip.count({
        where: {
          status: { in: ['UPCOMING', 'BOOKING_OPEN', 'BOOKING_CLOSED', 'CAB_ASSIGNED', 'IN_PROGRESS'] }
        }
      }),
      
      // Pending payments
      prisma.payment.count({
        where: { status: 'PENDING' }
      }),
      
      // Today's bookings
      prisma.booking.count({
        where: {
          createdAt: { gte: today }
        }
      }),

      // Total trips
      prisma.trip.count(),

      // Monthly revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1)
          }
        },
        _sum: { amount: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalBookings,
        totalRevenue: totalRevenue._sum.amount || 0,
        activeTrips,
        pendingPayments,
        todayBookings,
        totalTrips,
        monthlyRevenue: monthlyRevenue._sum.amount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    });
  }
});

// Get all cabs for a trip
router.get('/trips/:tripId/cabs', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;

    const cabs = await prisma.cab.findMany({
      where: { tripId },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                rollNumber: true
              }
            },
            booking: {
              select: {
                status: true,
                attended: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      data: cabs
    });
  } catch (error) {
    console.error('Error fetching cabs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cabs'
    });
  }
});

// Create cab for trip
router.post('/cabs', authenticate, authorizeAdmin, validateBody(createCabSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId, vehicleType, vehicleNumber, driverName, driverPhone, maxCapacity } = req.body;

    // Validate capacity based on vehicle type
    const maxCapacities: Record<VehicleType, number> = {
      'CAB': 7,
      'AUTO': 10,
      'TOTO': 5
    };

    if (maxCapacity > maxCapacities[vehicleType]) {
      return res.status(400).json({
        success: false,
        error: `Maximum capacity for ${vehicleType} is ${maxCapacities[vehicleType]}`
      });
    }

    const cab = await prisma.cab.create({
      data: {
        tripId,
        vehicleType,
        vehicleNumber: vehicleNumber.toUpperCase(),
        driverName,
        driverPhone,
        maxCapacity
      }
    });

    res.status(201).json({
      success: true,
      data: cab,
      message: 'Cab added successfully'
    });
  } catch (error) {
    console.error('Error creating cab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create cab'
    });
  }
});

// Update cab
router.patch('/cabs/:id', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { vehicleNumber, driverName, driverPhone, maxCapacity } = req.body;

    const cab = await prisma.cab.update({
      where: { id },
      data: {
        ...(vehicleNumber && { vehicleNumber: vehicleNumber.toUpperCase() }),
        ...(driverName !== undefined && { driverName }),
        ...(driverPhone !== undefined && { driverPhone }),
        ...(maxCapacity && { maxCapacity })
      }
    });

    res.json({
      success: true,
      data: cab,
      message: 'Cab updated successfully'
    });
  } catch (error) {
    console.error('Error updating cab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update cab'
    });
  }
});

// Delete cab
router.delete('/cabs/:id', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.cab.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Cab deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete cab'
    });
  }
});

// Auto-assign cabs to bookings
router.post('/trips/:tripId/auto-assign', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;

    // Get all cabs for the trip
    const cabs = await prisma.cab.findMany({
      where: { tripId },
      orderBy: { createdAt: 'asc' }
    });

    if (cabs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No cabs available for this trip'
      });
    }

    // Get all confirmed bookings without cab assignment
    const bookings = await prisma.booking.findMany({
      where: {
        tripId,
        status: 'CONFIRMED',
        cabAssignment: null
      },
      orderBy: { createdAt: 'asc' }
    });

    if (bookings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No unassigned bookings found'
      });
    }

    // Assign bookings to cabs (fill one cab before moving to next)
    const assignments = [];
    let cabIndex = 0;
    let currentCab = cabs[cabIndex];
    let seatNumber = 1;

    for (const booking of bookings) {
      // Check if current cab is full
      if (currentCab.currentOccupancy >= currentCab.maxCapacity) {
        cabIndex++;
        if (cabIndex >= cabs.length) {
          break; // No more cabs available
        }
        currentCab = cabs[cabIndex];
        seatNumber = 1;
      }

      // Create assignment
      const assignment = await prisma.cabAssignment.create({
        data: {
          cabId: currentCab.id,
          userId: booking.userId,
          bookingId: booking.id,
          seatNumber
        }
      });

      // Update cab occupancy
      await prisma.cab.update({
        where: { id: currentCab.id },
        data: {
          currentOccupancy: {
            increment: 1
          }
        }
      });

      assignments.push(assignment);
      seatNumber++;
      currentCab.currentOccupancy++;
    }

    // Update trip status
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: 'CAB_ASSIGNED' }
    });

    res.json({
      success: true,
      data: {
        assignments,
        totalAssigned: assignments.length,
        totalBookings: bookings.length
      },
      message: `Successfully assigned ${assignments.length} bookings to cabs`
    });
  } catch (error) {
    console.error('Error auto-assigning cabs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-assign cabs'
    });
  }
});

// Manual cab assignment
router.post('/assign-cab', authenticate, authorizeAdmin, validateBody(assignCabSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { cabId, bookingId } = req.body;

    // Check if cab has space
    const cab = await prisma.cab.findUnique({
      where: { id: cabId }
    });

    if (!cab) {
      return res.status(404).json({
        success: false,
        error: 'Cab not found'
      });
    }

    if (cab.currentOccupancy >= cab.maxCapacity) {
      return res.status(400).json({
        success: false,
        error: 'Cab is full'
      });
    }

    // Check if booking exists and is confirmed
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        error: 'Booking is not confirmed'
      });
    }

    // Check if already assigned
    const existingAssignment = await prisma.cabAssignment.findUnique({
      where: { bookingId }
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        error: 'Booking already assigned to a cab'
      });
    }

    // Create assignment
    const assignment = await prisma.cabAssignment.create({
      data: {
        cabId,
        userId: booking.userId,
        bookingId,
        seatNumber: cab.currentOccupancy + 1
      }
    });

    // Update cab occupancy
    await prisma.cab.update({
      where: { id: cabId },
      data: {
        currentOccupancy: {
          increment: 1
        }
      }
    });

    res.json({
      success: true,
      data: assignment,
      message: 'Cab assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning cab:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign cab'
    });
  }
});

// Remove cab assignment
router.delete('/assignments/:id', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.cabAssignment.findUnique({
      where: { id }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Delete assignment
    await prisma.cabAssignment.delete({
      where: { id }
    });

    // Update cab occupancy
    await prisma.cab.update({
      where: { id: assignment.cabId },
      data: {
        currentOccupancy: {
          decrement: 1
        }
      }
    });

    res.json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    console.error('Error removing assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove assignment'
    });
  }
});

// Get pending payments summary
router.get('/payments/pending-summary', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const pendingPayments = await prisma.payment.findMany({
      where: { status: 'PENDING' },
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
      orderBy: { createdAt: 'desc' }
    });

    const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      data: {
        pendingPayments,
        totalPending,
        count: pendingPayments.length
      }
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending payments'
    });
  }
});

export default router;
