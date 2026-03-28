// User types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  rollNumber?: string;
  department?: string;
  isAdmin: boolean;
  isBlocked?: boolean;
  createdAt: string;
  hasPendingPayments?: boolean;
}

// Trip types
export type TripStatus = 'UPCOMING' | 'BOOKING_OPEN' | 'BOOKING_CLOSED' | 'CAB_ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Trip {
  id: string;
  title: string;
  description?: string;
  date: string;
  bookingStartTime: string;
  bookingEndTime: string;
  cancellationDeadline?: string;
  departureTime: string;
  returnTime?: string;
  status: TripStatus;
  totalCost?: number;
  costPerPerson?: number;
  maxBookings: number;
  currentBookings: number;
  paymentWindowOpen: boolean;
  createdAt: string;
  userBooking?: {
    id: string;
    status: string;
  } | null;
  cabs?: Cab[];
  _count?: {
    bookings: number;
  };
}

// Booking types
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export interface Booking {
  id: string;
  userId: string;
  tripId: string;
  status: BookingStatus;
  attended: boolean;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  trip: Trip;
  user?: User;
  payment?: Payment;
  cabAssignment?: CabAssignment;
}

// Cab types
export type VehicleType = 'CAB' | 'AUTO' | 'TOTO';

export interface Cab {
  id: string;
  tripId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  driverName?: string;
  driverPhone?: string;
  maxCapacity: number;
  currentOccupancy: number;
  assignments?: CabAssignment[];
}

export interface CabAssignment {
  id: string;
  cabId: string;
  userId: string;
  bookingId: string;
  seatNumber?: number;
  user?: {
    id: string;
    name: string;
    email: string;
    rollNumber?: string;
  };
  cab?: Cab;
  booking?: Booking;
}

// Payment types
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  userId: string;
  tripId: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
  createdAt: string;
  trip?: Trip;
  user?: User;
  booking?: Booking;
}

// Dashboard stats
export interface UserDashboardStats {
  totalTrips: number;
  activeBookings: number;
  completedTrips: number;
  upcomingTrips: number;
  pendingPayments: number;
  totalSpent: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  activeTrips: number;
  pendingPayments: number;
  todayBookings: number;
  totalTrips: number;
  monthlyRevenue: number;
}

// Analytics types
export interface AnalyticsSummary {
  totalTrips: number;
  totalBookings: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  pendingAmount: number;
}

export interface DailyStats {
  date: string;
  trips: number;
  bookings: number;
  revenue: number;
}

export interface AnalyticsData {
  month: number;
  year: number;
  summary: AnalyticsSummary;
  dailyStats: DailyStats[];
  vehicleDistribution: {
    vehicleType: VehicleType;
    _count: { id: number };
  }[];
  paymentStatusDistribution: {
    status: PaymentStatus;
    _count: { id: number };
    _sum: { amount: number };
  }[];
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form types
export interface CreateTripFormData {
  title: string;
  description?: string;
  date: string;
  bookingStartTime: string;
  bookingEndTime: string;
  cancellationDeadline?: string;
  departureTime: string;
  returnTime?: string;
  maxBookings?: number;
}

export interface CreateCabFormData {
  tripId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  driverName?: string;
  driverPhone?: string;
  maxCapacity: number;
}

export interface UpdateProfileFormData {
  name?: string;
  phone?: string;
  department?: string;
}
