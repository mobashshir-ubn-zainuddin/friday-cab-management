import { Trip } from '@prisma/client';

export type EffectiveTripStatus = 
  | 'UPCOMING'
  | 'BOOKING_OPEN'
  | 'BOOKING_CLOSED'
  | 'CAB_ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TripWithRelations extends Trip {
  cabs?: { currentOccupancy: number }[];
}

/**
 * Computes the effective trip status based on timestamps and cab assignments.
 * This is the single source of truth for trip lifecycle.
 * 
 * Priority order (highest to lowest):
 * 1. CANCELLED (explicit admin action) - always wins
 * 2. COMPLETED (returnTime passed)
 * 3. IN_PROGRESS (departureTime <= now < returnTime)
 * 4. CAB_ASSIGNED (cabs assigned AND before departureTime)
 * 5. BOOKING_CLOSED (bookingEndTime <= now < departureTime)
 * 6. BOOKING_OPEN (bookingStartTime <= now < bookingEndTime)
 * 7. UPCOMING (now < bookingStartTime)
 */
const VALID_STATUSES: EffectiveTripStatus[] = ['UPCOMING', 'BOOKING_OPEN', 'BOOKING_CLOSED', 'CAB_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function isValidStatus(status: string): status is EffectiveTripStatus {
  return VALID_STATUSES.includes(status as EffectiveTripStatus);
}

export function getEffectiveTripStatus(trip: TripWithRelations, now: Date = new Date()): EffectiveTripStatus {
  // CANCELLED is an explicit admin action - always takes precedence
  if (trip.status === 'CANCELLED') {
    return 'CANCELLED';
  }

  // Defensive: validate date fields exist and are parseable
  const bookingStartTime = trip.bookingStartTime;
  const bookingEndTime = trip.bookingEndTime;
  const departureTime = trip.departureTime;
  const returnTimeValue = trip.returnTime;

  if (!bookingStartTime || !bookingEndTime || !departureTime) {
    console.warn('[tripStatus] Missing required date fields for trip', trip.id, { bookingStartTime, bookingEndTime, departureTime });
    return 'UPCOMING';
  }

  const bookingStart = new Date(bookingStartTime).getTime();
  const bookingEnd = new Date(bookingEndTime).getTime();
  const departure = new Date(departureTime).getTime();
  const returnTime = returnTimeValue ? new Date(returnTimeValue).getTime() : null;
  const nowTime = now.getTime();

  // Validate timestamps are valid numbers
  if (isNaN(bookingStart) || isNaN(bookingEnd) || isNaN(departure) || (returnTime !== null && isNaN(returnTime))) {
    console.warn('[tripStatus] Invalid timestamp for trip', trip.id, { bookingStart, bookingEnd, departure, returnTime });
    return 'UPCOMING';
  }

  // Check if trip has assigned cabs (at least one cab with assignments)
  const hasAssignedCabs = trip.cabs?.some(cab => cab.currentOccupancy > 0) ?? false;

  // COMPLETED: returnTime has passed (or departure passed if no returnTime)
  if (returnTime && nowTime >= returnTime) {
    return 'COMPLETED';
  }
  if (!returnTime && nowTime >= departure) {
    return 'COMPLETED';
  }

  // IN_PROGRESS: departure time has arrived but return time hasn't
  if (nowTime >= departure) {
    return 'IN_PROGRESS';
  }

  // CAB_ASSIGNED: cabs are assigned and we're before departure
  // This only applies if we're past booking window or in it
  if (hasAssignedCabs) {
    return 'CAB_ASSIGNED';
  }

  // BOOKING_CLOSED: booking window has closed but departure hasn't arrived
  if (nowTime >= bookingEnd) {
    return 'BOOKING_CLOSED';
  }

  // BOOKING_OPEN: within booking window
  if (nowTime >= bookingStart) {
    return 'BOOKING_OPEN';
  }

  // UPCOMING: before booking window opens
  return 'UPCOMING';
}

/**
 * Checks if booking is currently allowed for a trip.
 * This should be used by the booking API to authorize bookings.
 */
export function isBookingCurrentlyOpen(trip: TripWithRelations, now: Date = new Date()): boolean {
  // Cannot book cancelled trips
  if (trip.status === 'CANCELLED') {
    return false;
  }

  const nowTime = now.getTime();
  const bookingStart = new Date(trip.bookingStartTime).getTime();
  const bookingEnd = new Date(trip.bookingEndTime).getTime();

  // Booking is open only within the configured window
  return nowTime >= bookingStart && nowTime < bookingEnd;
}

/**
 * Checks if a trip can be cancelled by a user.
 * Uses cancellationDeadline if set, otherwise uses departureTime.
 */
export function canUserCancelBooking(trip: TripWithRelations, now: Date = new Date()): boolean {
  if (trip.status === 'CANCELLED') {
    return false;
  }

  const nowTime = now.getTime();
  const departure = new Date(trip.departureTime).getTime();
  const cancellationDeadline = trip.cancellationDeadline 
    ? new Date(trip.cancellationDeadline).getTime() 
    : null;

  // Cannot cancel after departure
  if (nowTime >= departure) {
    return false;
  }

  // Check cancellation deadline if set
  if (cancellationDeadline && nowTime > cancellationDeadline) {
    return false;
  }

  return true;
}

/**
 * Determines the display label for a trip status (for UI badges).
 */
export function getTripStatusLabel(status: EffectiveTripStatus): string {
  const labels: Record<EffectiveTripStatus, string> = {
    UPCOMING: 'Upcoming',
    BOOKING_OPEN: 'Booking Open',
    BOOKING_CLOSED: 'Booking Closed',
    CAB_ASSIGNED: 'Cab Assigned',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  };
  return labels[status];
}

/**
 * Gets the badge style class for a trip status.
 */
export function getTripStatusStyle(status: EffectiveTripStatus): string {
  const styles: Record<EffectiveTripStatus, string> = {
    UPCOMING: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    BOOKING_OPEN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    BOOKING_CLOSED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    CAB_ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    IN_PROGRESS: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30'
  };
  return styles[status];
}

/**
 * Synchronizes trip statuses in the database based on current time.
 * This ensures the persisted Trip.status matches the time-based effective status.
 * 
 * Rules:
 * - CANCELLED trips are never auto-updated (explicit admin action)
 * - Only updates status if it actually changes
 * - Does NOT auto-open payment window - that requires admin action with total cost
 * - Returns object with updated count and candidate count
 * 
 * Optimization: Only queries trips whose status could actually change at the current time.
 * Trip status changes only at specific time boundaries:
 * - bookingStartTime: UPCOMING -> BOOKING_OPEN
 * - bookingEndTime: BOOKING_OPEN -> BOOKING_CLOSED (or CAB_ASSIGNED)
 * - departureTime: BOOKING_CLOSED/CAB_ASSIGNED -> IN_PROGRESS
 * - returnTime: IN_PROGRESS -> COMPLETED
 * So we only fetch trips where any of these timestamps are within a small window of the current time.
 * 
 * Further optimization: First does a cheap count check. If no candidate trips exist,
 * skips the expensive findMany query entirely.
 */
export async function syncTripStatuses(prisma: any): Promise<{ updated: number; candidates: number }> {
  const now = new Date();
  const nowTime = now.getTime();
  
  // Window: check trips whose status boundaries are within ±5 minutes of now
  // This covers all possible status transitions that could happen "now"
  const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const windowStart = new Date(nowTime - WINDOW_MS);
  const windowEnd = new Date(nowTime + WINDOW_MS);

  // First, do a cheap count to check if any candidate trips exist
  const candidateCount = await prisma.trip.count({
    where: {
      status: { not: 'CANCELLED' },
      OR: [
        { bookingStartTime: { gte: windowStart, lte: windowEnd } },
        { bookingEndTime: { gte: windowStart, lte: windowEnd } },
        { departureTime: { gte: windowStart, lte: windowEnd } },
        { returnTime: { gte: windowStart, lte: windowEnd } }
      ]
    }
  });

  // If no trips have status boundaries near current time, skip the expensive query
  if (candidateCount === 0) {
    return { updated: 0, candidates: 0 };
  }

  // Fetch only non-cancelled trips where at least one status boundary timestamp
  // falls within the current time window. These are the only trips whose
  // effective status could differ from their persisted status at this moment.
  const trips = await prisma.trip.findMany({
    where: {
      status: { not: 'CANCELLED' },
      OR: [
        { bookingStartTime: { gte: windowStart, lte: windowEnd } },
        { bookingEndTime: { gte: windowStart, lte: windowEnd } },
        { departureTime: { gte: windowStart, lte: windowEnd } },
        { returnTime: { gte: windowStart, lte: windowEnd } }
      ]
    },
    include: {
      cabs: {
        select: { currentOccupancy: true }
      }
    }
  });

  let updatedCount = 0;

  for (const trip of trips) {
    const effectiveStatus = getEffectiveTripStatus(trip, now);
    
    // Only update if the persisted status differs from effective status
    if (trip.status !== effectiveStatus) {
      await prisma.trip.update({
        where: { id: trip.id },
        data: { status: effectiveStatus }
      });
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    console.log(`[syncTripStatuses] Updated ${updatedCount} trip statuses at ${now.toISOString()} (queried ${trips.length} candidates)`);
  }

  return { updated: updatedCount, candidates: candidateCount };
}

/**
 * Synchronizes a single trip's status.
 * Useful when a specific trip's time has passed and we need fresh status immediately.
 */
export async function syncSingleTripStatus(prisma: any, tripId: string): Promise<EffectiveTripStatus | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      cabs: {
        select: { currentOccupancy: true }
      }
    }
  });

  if (!trip) {
    return null;
  }

  const now = new Date();
  const effectiveStatus = getEffectiveTripStatus(trip, now);

  if (trip.status !== effectiveStatus && trip.status !== 'CANCELLED') {
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: effectiveStatus }
    });
    console.log(`[syncSingleTripStatus] Trip ${tripId} status updated: ${trip.status} -> ${effectiveStatus}`);
  }

  return effectiveStatus;
}