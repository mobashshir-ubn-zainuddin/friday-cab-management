import { Request } from 'express';
import { User, Trip, Booking, Cab, Payment, VehicleType, TripStatus, BookingStatus, PaymentStatus } from '@prisma/client';

// Extended Express Request with user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      phone?: string;
      rollNumber?: string;
      department?: string;
      isAdmin: boolean;
      isBlocked: boolean;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export interface AuthenticatedRequest extends Request<
  any,   // params
  any,   // res body
  any,   // req body
  any    // query
> {
  user?: Express.User;
}

export interface JwtPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Trip types
export interface CreateTripInput {
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

export interface UpdateTripInput extends Partial<CreateTripInput> {
  status?: TripStatus;
  totalCost?: number;
  paymentWindowOpen?: boolean;
}

// Booking types
export interface CreateBookingInput {
  tripId: string;
}

export interface UpdateBookingInput {
  status?: BookingStatus;
  attended?: boolean;
}

// Cab types
export interface CreateCabInput {
  tripId: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  driverName?: string;
  driverPhone?: string;
  maxCapacity: number;
}

export interface CabAssignmentInput {
  cabId: string;
  userId: string;
  bookingId: string;
  seatNumber?: number;
}

// Payment types
export interface CreatePaymentInput {
  tripId: string;
  bookingId: string;
  amount: number;
}

export interface RazorpayPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

// User types
export interface UpdateUserInput {
  name?: string;
  phone?: string;
  department?: string;
}

// Analytics types
export interface AnalyticsData {
  month: number;
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  totalTrips: number;
  totalBookings: number;
  collectedAmount: number;
  pendingAmount: number;
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
}

// Email types
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

// Re-export Prisma enums
export { VehicleType, TripStatus, BookingStatus, PaymentStatus };

export {};
