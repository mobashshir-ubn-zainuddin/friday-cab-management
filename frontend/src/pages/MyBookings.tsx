import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingApi } from '@/services/api';
import type { Booking, BookingStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Car,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  User,
  Phone,
  ArrowRight,
  Ticket
} from 'lucide-react';

const MyBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await bookingApi.getMyBookings();
      setBookings((data as any).bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellingBooking) return;

    setCancelLoading(true);
    try {
      await bookingApi.cancel(cancellingBooking.id);
      toast.success('Booking cancelled successfully');
      fetchBookings();
      setCancellingBooking(null);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to cancel booking';
      toast.error(message);
    } finally {
      setCancelLoading(false);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    const styles: Record<BookingStatus, string> = {
      CONFIRMED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30',
      ATTENDED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      NO_SHOW: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    };

    const labels: Record<BookingStatus, string> = {
      CONFIRMED: 'Confirmed',
      CANCELLED: 'Cancelled',
      ATTENDED: 'Attended',
      NO_SHOW: 'No Show'
    };

    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getTimelineSteps = (booking: Booking) => {
    const steps = [
      { label: 'Booked', completed: true, icon: Ticket },
      { label: 'Booking Closed', completed: booking.trip.status !== 'BOOKING_OPEN', icon: XCircle },
      { label: 'Cab Assigned', completed: !!booking.cabAssignment, icon: Car },
      { label: 'Trip Completed', completed: booking.trip.status === 'COMPLETED', icon: CheckCircle },
      { 
        label: booking.payment?.status === 'COMPLETED' ? 'Paid' : 'Payment Pending', 
        completed: booking.payment?.status === 'COMPLETED', 
        icon: CreditCard 
      }
    ];
    return steps;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canCancel = (booking: Booking) => {
    if (booking.status !== 'CONFIRMED') return false;
    if (booking.trip.status === 'COMPLETED') return false;
    if (booking.trip.cancellationDeadline) {
      return new Date() < new Date(booking.trip.cancellationDeadline);
    }
    return new Date() < new Date(booking.trip.departureTime);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64 bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  // Separate active and past bookings
  const activeBookings = bookings.filter(b => 
    b.status === 'CONFIRMED' && 
    !['COMPLETED', 'CANCELLED'].includes(b.trip.status)
  );
  const pastBookings = bookings.filter(b => 
    b.status !== 'CONFIRMED' || 
    ['COMPLETED', 'CANCELLED'].includes(b.trip.status)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Bookings</h1>
        <p className="text-slate-400">Track your trip bookings and payments</p>
      </div>

      {/* Active Bookings */}
      {activeBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Active Bookings</h2>
          <div className="grid gap-4">
            {activeBookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking}
                onCancel={() => setCancellingBooking(booking)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Bookings */}
      {pastBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Past Bookings</h2>
          <div className="grid gap-4">
            {pastBookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking}
                isPast
              />
            ))}
          </div>
        </div>
      )}

      {/* No Bookings */}
      {bookings.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-white font-medium text-lg">No bookings yet</h3>
            <p className="text-slate-400 mt-2">Start by booking a trip</p>
            <Button asChild className="mt-4 bg-emerald-500 hover:bg-emerald-600">
              <Link to="/trips">Browse Trips</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cancel Dialog */}
      <Dialog open={!!cancellingBooking} onOpenChange={() => setCancellingBooking(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to cancel this booking?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300/80 text-sm">
                Once cancelled, you may not be able to book this trip again if the booking window closes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancellingBooking(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Keep Booking
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelLoading}
              variant="destructive"
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function BookingCard({ 
    booking, 
    onCancel, 
    isPast = false 
  }: { 
    booking: Booking; 
    onCancel?: () => void;
    isPast?: boolean;
  }) {
    const steps = getTimelineSteps(booking);

    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">{booking.trip.title}</h3>
                {getStatusBadge(booking.status)}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(booking.trip.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(booking.trip.departureTime)}
                </span>
              </div>
            </div>
            
            {!isPast && canCancel(booking) && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.label} className="flex flex-col items-center">
                  <div 
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${step.completed 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-slate-800 text-slate-500'
                      }
                    `}
                  >
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={`
                    text-xs mt-2 text-center max-w-[80px]
                    ${step.completed ? 'text-emerald-400' : 'text-slate-500'}
                  `}>
                    {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`
                      absolute h-0.5 w-[calc(20%-2rem)] 
                      ${step.completed ? 'bg-emerald-500/30' : 'bg-slate-800'}
                    `}
                    style={{ 
                      left: `calc(${(index + 0.5) * 20}% + 1rem)`,
                      top: '1.25rem'
                    }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cab Details */}
          {booking.cabAssignment && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <h4 className="text-sm font-medium text-white mb-3">Cab Details</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                  <Car className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-slate-400">Vehicle</p>
                    <p className="text-white font-medium">
                      {booking.cabAssignment.cab?.vehicleType} - {booking.cabAssignment.cab?.vehicleNumber}
                    </p>
                  </div>
                </div>
                {booking.cabAssignment.seatNumber && (
                  <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm text-slate-400">Seat Number</p>
                      <p className="text-white font-medium">{booking.cabAssignment.seatNumber}</p>
                    </div>
                  </div>
                )}
                {booking.cabAssignment.cab?.driverName && (
                  <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                    <User className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm text-slate-400">Driver</p>
                      <p className="text-white font-medium">{booking.cabAssignment.cab.driverName}</p>
                    </div>
                  </div>
                )}
                {booking.cabAssignment.cab?.driverPhone && (
                  <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                    <Phone className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-sm text-slate-400">Contact</p>
                      <p className="text-white font-medium">{booking.cabAssignment.cab.driverPhone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Info */}
          {booking.payment && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Your Share</p>
                  <p className="text-xl font-bold text-white">₹{booking.payment.amount}</p>
                </div>
                <div className="flex items-center gap-3">
                  {booking.payment.status === 'PENDING' ? (
                    <Button asChild className="bg-emerald-500 hover:bg-emerald-600">
                      <Link to="/payments">
                        Pay Now
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Paid
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
};

export default MyBookings;
