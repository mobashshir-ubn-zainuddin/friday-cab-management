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
  const requestId = (req as any).requestId || 'unknown';
  const overallStart = process.hrtime.bigint();
  
  try {
    const { month, year } = req.query;

    const defaults = istDefaultMonth();
    const targetMonth = month ? parseInt(month as string) : defaults.month;
    const targetYear = year ? parseInt(year as string) : defaults.year;

    // Date range for the month (IST boundaries converted to UTC)
    const startDate = istMonthStart(targetYear, targetMonth);
    const endDate = istMonthEnd(targetYear, targetMonth);

    // Get daily breakdown using database aggregation instead of in-memory filtering
    const dailyStatsQueryStart = process.hrtime.bigint();
    const dailyStatsRaw = await prisma.$queryRaw<Array<{ date: Date; trips: bigint; bookings: bigint; revenue: number }>>`
      SELECT 
        DATE(t.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') as date,
        COUNT(DISTINCT t.id)::bigint as trips,
        COUNT(DISTINCT b.id)::bigint as bookings,
        COALESCE(SUM(p.amount), 0) as revenue
      FROM "Trip" t
      LEFT JOIN "Booking" b ON b."tripId" = t.id AND b.status IN ('CONFIRMED', 'ATTENDED')
      LEFT JOIN "Payment" p ON p."tripId" = t.id AND p.status = 'COMPLETED'
      WHERE t.date >= ${startDate} AND t.date <= ${endDate}
      GROUP BY DATE(t.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date
    `;
    const dailyStatsQueryMs = Number(process.hrtime.bigint() - dailyStatsQueryStart) / 1_000_000;

    // Get summary metrics using parallel queries
    const summaryQueryStart = process.hrtime.bigint();
    const [
      totalTrips,
      totalBookings,
      totalRevenue,
      totalExpenses,
      vehicleDistribution,
      paymentStatusDistribution
    ] = await Promise.all([
      prisma.trip.count({
        where: { date: { gte: startDate, lte: endDate } }
      }),
      prisma.booking.count({
        where: {
          trip: { date: { gte: startDate, lte: endDate } },
          status: { in: ['CONFIRMED', 'ATTENDED'] }
        }
      }),
      prisma.payment.aggregate({
        where: {
          trip: { date: { gte: startDate, lte: endDate } },
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      }),
      prisma.trip.aggregate({
        where: { date: { gte: startDate, lte: endDate } },
        _sum: { totalCost: true }
      }),
      prisma.cab.groupBy({
        by: ['vehicleType'],
        _count: { id: true }
      }),
      prisma.payment.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _count: { id: true },
        _sum: { amount: true }
      })
    ]);
    const summaryQueryMs = Number(process.hrtime.bigint() - summaryQueryStart) / 1_000_000;

    const totalRevenueAmount = totalRevenue._sum.amount || 0;
    const totalExpensesAmount = totalExpenses._sum.totalCost || 0;
    const pendingAmount = 0; // Calculate from payments if needed

    // Format daily stats
    const dailyStats = dailyStatsRaw.map(row => ({
      date: formatAsISTDateString(row.date),
      trips: Number(row.trips),
      bookings: Number(row.bookings),
      revenue: row.revenue
    }));

    // Update or create analytics record (fire and forget)
    prisma.analytics.upsert({
      where: {
        month_year: {
          month: targetMonth,
          year: targetYear
        }
      },
      update: {
        totalRevenue: totalRevenueAmount,
        totalExpenses: totalExpensesAmount,
        totalTrips,
        totalBookings,
        collectedAmount: totalRevenueAmount,
        pendingAmount
      },
      create: {
        month: targetMonth,
        year: targetYear,
        totalRevenue: totalRevenueAmount,
        totalExpenses: totalExpensesAmount,
        totalTrips,
        totalBookings,
        collectedAmount: totalRevenueAmount,
        pendingAmount
      }
    }).catch(err => console.error('Analytics upsert failed:', err));

    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    if (totalMs > 500) {
      console.log(`[Analytics GET /] Request ${requestId} - Total: ${totalMs.toFixed(2)}ms, DailyStats: ${dailyStatsQueryMs.toFixed(2)}ms, Summary: ${summaryQueryMs.toFixed(2)}ms`);
    }

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        summary: {
          totalTrips,
          totalBookings,
          totalRevenue: totalRevenueAmount,
          totalExpenses: totalExpensesAmount,
          profit: totalRevenueAmount - totalExpensesAmount,
          pendingAmount
        },
        dailyStats,
        vehicleDistribution,
        paymentStatusDistribution
      }
    });
  } catch (error) {
    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    console.error(`[Analytics GET /] Request ${requestId} failed after ${totalMs.toFixed(2)}ms:`, error);
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

    // First get users with their booking/payment counts
    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
      }),
      prisma.user.count()
    ]);

    // Batch totalSpent query for all users in a single query
    const userIds = users.map(u => u.id);
    const totalSpentData = await prisma.payment.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });

    // Create a map for quick lookup
    const totalSpentMap = new Map(totalSpentData.map(item => [item.userId, item._sum.amount || 0]));

    const usersWithStats = users.map(user => ({
      ...user,
      totalSpent: totalSpentMap.get(user.id) || 0
    }));

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
  const requestId = (req as any).requestId || 'unknown';
  const overallStart = process.hrtime.bigint();
  
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : istDefaultMonth().year;

    // Use a single query with grouping instead of 12 separate queries
    const monthlyQueryStart = process.hrtime.bigint();
    const monthlyDataRaw = await prisma.$queryRaw<Array<{ month: number; trips: bigint; revenue: number; expense: number }>>`
      SELECT 
        EXTRACT(MONTH FROM t.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::int as month,
        COUNT(DISTINCT t.id)::bigint as trips,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'COMPLETED'), 0) as revenue,
        COALESCE(SUM(t."totalCost"), 0) as expense
      FROM "Trip" t
      LEFT JOIN "Payment" p ON p."tripId" = t.id
      WHERE EXTRACT(YEAR FROM t.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = ${targetYear}
      GROUP BY EXTRACT(MONTH FROM t.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
      ORDER BY month
    `;
    const monthlyQueryMs = Number(process.hrtime.bigint() - monthlyQueryStart) / 1_000_000;

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Build complete 12-month data, filling gaps with zeros
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const found = monthlyDataRaw.find(row => Number(row.month) === month);
      const trips = found ? Number(found.trips) : 0;
      const revenue = found ? Number(found.revenue) : 0;
      const expense = found ? Number(found.expense) : 0;

      monthlyData.push({
        month,
        monthName: MONTH_NAMES[month - 1],
        trips,
        revenue,
        expense,
        profit: revenue - expense
      });
    }

    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    if (totalMs > 500) {
      console.log(`[Analytics GET /monthly-comparison] Request ${requestId} - Total: ${totalMs.toFixed(2)}ms, MonthlyQuery: ${monthlyQueryMs.toFixed(2)}ms`);
    }

    res.json({
      success: true,
      data: {
        year: targetYear,
        monthlyData
      }
    });
  } catch (error) {
    const totalMs = Number(process.hrtime.bigint() - overallStart) / 1_000_000;
    console.error(`[Analytics GET /monthly-comparison] Request ${requestId} failed after ${totalMs.toFixed(2)}ms:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly comparison'
    });
  }
});

export default router;
