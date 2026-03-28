import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get analytics dashboard
router.get('/', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { month, year } = req.query;
    
    const now = new Date();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : now.getFullYear();

    // Date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get all trips in the month
    const trips = await prisma.trip.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        bookings: {
          where: {
            status: { in: ['CONFIRMED', 'ATTENDED'] }
          }
        },
        payments: {
          where: {
            status: 'COMPLETED'
          }
        },
        cabs: true
      }
    });

    // Calculate metrics
    const totalTrips = trips.length;
    const totalBookings = trips.reduce((sum, t) => sum + t.bookings.length, 0);
    const totalRevenue = trips.reduce((sum, t) => 
      sum + t.payments.reduce((pSum, p) => pSum + p.amount, 0), 0
    );
    const totalExpenses = trips.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const pendingAmount = trips.reduce((sum, t) => {
      const attendedBookings = t.bookings.filter(b => b.attended).length;
      const expectedAmount = (t.costPerPerson || 0) * attendedBookings;
      const collectedAmount = t.payments.reduce((pSum, p) => pSum + p.amount, 0);
      return sum + (expectedAmount - collectedAmount);
    }, 0);

    // Get daily breakdown
    const dailyStats = [];
    for (let day = 1; day <= endDate.getDate(); day++) {
      const dayStart = new Date(targetYear, targetMonth - 1, day);
      const dayEnd = new Date(targetYear, targetMonth - 1, day, 23, 59, 59);
      
      const dayTrips = trips.filter(t => {
        const tripDate = new Date(t.date);
        return tripDate >= dayStart && tripDate <= dayEnd;
      });

      if (dayTrips.length > 0) {
        dailyStats.push({
          date: dayStart.toISOString().split('T')[0],
          trips: dayTrips.length,
          bookings: dayTrips.reduce((sum, t) => sum + t.bookings.length, 0),
          revenue: dayTrips.reduce((sum, t) => 
            sum + t.payments.reduce((pSum, p) => pSum + p.amount, 0), 0
          )
        });
      }
    }

    // Get vehicle type distribution
    const vehicleDistribution = await prisma.cab.groupBy({
      by: ['vehicleType'],
      _count: {
        id: true
      }
    });

    // Get payment status distribution
    const paymentStatusDistribution = await prisma.payment.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    // Update or create analytics record
    await prisma.analytics.upsert({
      where: {
        month_year: {
          month: targetMonth,
          year: targetYear
        }
      },
      update: {
        totalRevenue,
        totalExpenses,
        totalTrips,
        totalBookings,
        collectedAmount: totalRevenue,
        pendingAmount
      },
      create: {
        month: targetMonth,
        year: targetYear,
        totalRevenue,
        totalExpenses,
        totalTrips,
        totalBookings,
        collectedAmount: totalRevenue,
        pendingAmount
      }
    });

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        summary: {
          totalTrips,
          totalBookings,
          totalRevenue,
          totalExpenses,
          profit: totalRevenue - totalExpenses,
          pendingAmount
        },
        dailyStats,
        vehicleDistribution,
        paymentStatusDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

// Get profit/loss report
router.get('/profit-loss', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59);

    const trips = await prisma.trip.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        payments: {
          where: {
            status: 'COMPLETED'
          }
        },
        bookings: {
          where: {
            status: { in: ['CONFIRMED', 'ATTENDED'] }
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    const report = trips.map(trip => {
      const revenue = trip.payments.reduce((sum, p) => sum + p.amount, 0);
      const expense = trip.totalCost || 0;
      const attendedCount = trip.bookings.filter(b => b.attended).length;
      
      return {
        tripId: trip.id,
        title: trip.title,
        date: trip.date,
        totalBookings: trip.bookings.length,
        attendedCount,
        revenue,
        expense,
        profit: revenue - expense,
        costPerPerson: trip.costPerPerson || 0
      };
    });

    const totals = report.reduce((acc, curr) => ({
      revenue: acc.revenue + curr.revenue,
      expense: acc.expense + curr.expense,
      profit: acc.profit + curr.profit,
      totalBookings: acc.totalBookings + curr.totalBookings,
      attendedCount: acc.attendedCount + curr.attendedCount
    }), { revenue: 0, expense: 0, profit: 0, totalBookings: 0, attendedCount: 0 });

    res.json({
      success: true,
      data: {
        report,
        totals,
        period: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    console.error('Error fetching profit/loss report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profit/loss report'
    });
  }
});

// Get user analytics
router.get('/users', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            payments: {
              where: { status: 'COMPLETED' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum
    });

    // Get total spent for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const totalSpent = await prisma.payment.aggregate({
          where: {
            userId: user.id,
            status: 'COMPLETED'
          },
          _sum: {
            amount: true
          }
        });

        return {
          ...user,
          totalSpent: totalSpent._sum.amount || 0
        };
      })
    );

    const total = await prisma.user.count();

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user analytics'
    });
  }
});

// Get monthly comparison
router.get('/monthly-comparison', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    const monthlyData = [];

    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(targetYear, month - 1, 1);
      const endDate = new Date(targetYear, month, 0, 23, 59, 59);

      const [trips, payments, expenses] = await Promise.all([
        prisma.trip.count({
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        prisma.payment.aggregate({
          where: {
            status: 'COMPLETED',
            paidAt: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: {
            amount: true
          }
        }),
        prisma.trip.aggregate({
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: {
            totalCost: true
          }
        })
      ]);

      const revenue = payments._sum.amount || 0;
      const expense = expenses._sum.totalCost || 0;

      monthlyData.push({
        month,
        monthName: new Date(targetYear, month - 1, 1).toLocaleString('default', { month: 'long' }),
        trips,
        revenue,
        expense,
        profit: revenue - expense
      });
    }

    res.json({
      success: true,
      data: {
        year: targetYear,
        monthlyData
      }
    });
  } catch (error) {
    console.error('Error fetching monthly comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly comparison'
    });
  }
});

export default router;
