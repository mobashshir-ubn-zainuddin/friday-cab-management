import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { fromZonedTime, toZonedTime, format as tzFormat } from 'date-fns-tz';
import { APP_TIMEZONE } from '../utils/timezone';

const router = Router();

const istMonthStart = (year: number, month: number): Date => {
  const naive = new Date();
  naive.setFullYear(year, month - 1, 1);
  naive.setHours(0, 0, 0, 0);
  return fromZonedTime(naive, APP_TIMEZONE);
};

const istMonthEnd = (year: number, month: number): Date => {
  const naive = new Date();
  naive.setFullYear(year, month, 0);
  naive.setHours(23, 59, 59, 999);
  return fromZonedTime(naive, APP_TIMEZONE);
};

const istDayStart = (year: number, month: number, day: number): Date => {
  const naive = new Date();
  naive.setFullYear(year, month - 1, day);
  naive.setHours(0, 0, 0, 0);
  return fromZonedTime(naive, APP_TIMEZONE);
};

const istDayEnd = (year: number, month: number, day: number): Date => {
  const naive = new Date();
  naive.setFullYear(year, month - 1, day);
  naive.setHours(23, 59, 59, 999);
  return fromZonedTime(naive, APP_TIMEZONE);
};

const istDefaultMonth = (): { month: number; year: number } => {
  const z = toZonedTime(new Date(), APP_TIMEZONE);
  return { month: z.getMonth() + 1, year: z.getFullYear() };
};

const istDayCountOfMonth = (year: number, month: number): number => {
  const naive = new Date();
  naive.setFullYear(year, month, 0);
  return naive.getDate();
};

const formatAsISTDateString = (d: Date): string =>
  tzFormat(d, 'yyyy-MM-dd', { timeZone: APP_TIMEZONE });

// Get analytics dashboard
router.get('/', authenticate, authorizeAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { month, year } = req.query;

    const defaults = istDefaultMonth();
    const targetMonth = month ? parseInt(month as string) : defaults.month;
    const targetYear = year ? parseInt(year as string) : defaults.year;

    // Date range for the month (IST boundaries converted to UTC)
    const startDate = istMonthStart(targetYear, targetMonth);
    const endDate = istMonthEnd(targetYear, targetMonth);

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

    // Get daily breakdown (filtering by IST calendar day, output IST date string)
    const dailyStats = [];
    const daysInMonth = istDayCountOfMonth(targetYear, targetMonth);
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = istDayStart(targetYear, targetMonth, day);
      const dayEnd = istDayEnd(targetYear, targetMonth, day);
      
      const dayTrips = trips.filter(t => {
        const tripDate = t.date instanceof Date ? t.date : new Date(t.date);
        return tripDate.getTime() >= dayStart.getTime() && tripDate.getTime() <= dayEnd.getTime();
      });

      if (dayTrips.length > 0) {
        dailyStats.push({
          date: formatAsISTDateString(dayStart),
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

    let start: Date;
    let end: Date;

    if (startDate) {
      const naive = new Date();
      const parts = (startDate as string).split('-').map(n => parseInt(n));
      naive.setFullYear(parts[0] || 2024, (parts[1] || 1) - 1, parts[2] || 1);
      naive.setHours(0, 0, 0, 0);
      start = fromZonedTime(naive, APP_TIMEZONE);
    } else {
      const def = istDefaultMonth();
      start = istMonthStart(def.year, 1);
    }

    if (endDate) {
      const naive = new Date();
      const parts = (endDate as string).split('-').map(n => parseInt(n));
      naive.setFullYear(parts[0] || 2024, (parts[1] || 1) - 1, parts[2] || 1);
      naive.setHours(23, 59, 59, 999);
      end = fromZonedTime(naive, APP_TIMEZONE);
    } else {
      const nowZoned = toZonedTime(new Date(), APP_TIMEZONE);
      const naive = new Date();
      naive.setFullYear(nowZoned.getFullYear(), nowZoned.getMonth(), nowZoned.getDate());
      naive.setHours(23, 59, 59, 999);
      end = fromZonedTime(naive, APP_TIMEZONE);
    }

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
          start: formatAsISTDateString(start),
          end: formatAsISTDateString(end)
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
    const targetYear = year ? parseInt(year as string) : istDefaultMonth().year;

    const monthlyData = [];

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (let month = 1; month <= 12; month++) {
      const startDate = istMonthStart(targetYear, month);
      const endDate = istMonthEnd(targetYear, month);

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
        monthName: MONTH_NAMES[month - 1],
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
