import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tripApi, bookingApi } from '@/services/api';
import type { Trip, TripStatus } from '@/types';
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
  Users,
  MapPin,
  Car,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Search
} from 'lucide-react';

const Trips = () => {
  const { hasPendingPayments } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingTrip, setBookingTrip] = useState<Trip | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const data = await tripApi.getAll({ upcoming: 'true' });
      setTrips((data as any).trips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const handleBookTrip = async () => {
    if (!bookingTrip) return;

    setBookingLoading(true);
    try {
      await bookingApi.create(bookingTrip.id);
      toast.success('Trip booked successfully!');
      fetchTrips();
      setBookingTrip(null);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to book trip';
      toast.error(message);
    } finally {
      setBookingLoading(false);
    }
  };

  const getStatusBadge = (status: TripStatus) => {
    const styles: Record<TripStatus, string> = {
      UPCOMING: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      BOOKING_OPEN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      BOOKING_CLOSED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      CAB_ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      IN_PROGRESS: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30'
    };

    const labels: Record<TripStatus, string> = {
      UPCOMING: 'Upcoming',
      BOOKING_OPEN: 'Booking Open',
      BOOKING_CLOSED: 'Booking Closed',
      CAB_ASSIGNED: 'Cab Assigned',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled'
    };

    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const isBookingOpen = (trip: Trip) => {
    const now = new Date();
    const startTime = new Date(trip.bookingStartTime);
    const endTime = new Date(trip.bookingEndTime);
    
    // Debug logs to see what's happening
    console.log('Trip:', trip.title);
    console.log('Now:', now.toISOString());
    console.log('Start:', startTime.toISOString());
    console.log('End:', endTime.toISOString());
    console.log('Status:', trip.status);

    return (
      (trip.status === 'BOOKING_OPEN' || trip.status === 'UPCOMING') &&
      now >= startTime &&
      now <= endTime
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 bg-slate-800" />
          <Skeleton className="h-10 w-32 bg-slate-800" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Available Trips</h1>
          <p className="text-slate-400">Browse and book trips for Friday prayer</p>
        </div>
      </div>

      {/* Pending Payment Warning */}
      {hasPendingPayments && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-400 font-medium">Payment Required</h3>
            <p className="text-red-300/80 text-sm mt-1">
              You have pending payments. Please clear your dues before booking new trips.
            </p>
          </div>
        </div>
      )}

      {/* Trips List */}
      {trips.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-white font-medium text-lg">No trips available</h3>
            <p className="text-slate-400 mt-2">Check back later for upcoming trips</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trips.map((trip) => (
            <Card key={trip.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Trip Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{trip.title}</h3>
                        <p className="text-slate-400 text-sm mt-1">{trip.description}</p>
                      </div>
                      {getStatusBadge(trip.status)}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300 text-sm">{formatDate(trip.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300 text-sm">{formatTime(trip.departureTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300 text-sm">
                          {trip.currentBookings}/{trip.maxBookings} booked
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300 text-sm">
                          {trip.cabs?.length || 0} vehicles
                        </span>
                      </div>
                    </div>

                    {/* Booking Window */}
                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Booking window:</span>
                        <span className="text-slate-300">
                          {formatTime(trip.bookingStartTime)} - {formatTime(trip.bookingEndTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 lg:min-w-[140px]">
                    {trip.userBooking ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Booked</span>
                        </div>
                        <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                          <Link to={`/trips/${trip.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </div>
                    ) : isBookingOpen(trip) ? (
                      <Button
                        onClick={() => setBookingTrip(trip)}
                        disabled={hasPendingPayments}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500"
                      >
                        Book Now
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Button 
                          disabled 
                          variant="outline" 
                          className="border-slate-700 text-slate-500 disabled:opacity-100"
                        >
                          {new Date() < new Date(trip.bookingStartTime) ? 'Booking Not Started' : 'Booking Closed'}
                        </Button>
                        {new Date() < new Date(trip.bookingStartTime) && (
                          <p className="text-[10px] text-slate-500 text-center">
                            Opens: {formatTime(trip.bookingStartTime)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking Dialog */}
      <Dialog open={!!bookingTrip} onOpenChange={() => setBookingTrip(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to book this trip?
            </DialogDescription>
          </DialogHeader>
          
          {bookingTrip && (
            <div className="py-4">
              <h4 className="font-medium text-white">{bookingTrip.title}</h4>
              <p className="text-slate-400 text-sm mt-1">
                {formatDate(bookingTrip.date)} at {formatTime(bookingTrip.departureTime)}
              </p>
              <div className="mt-4 p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-300">
                  <strong>Note:</strong> Payment will be collected after the trip is completed. 
                  The cost will be divided equally among all participants.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBookingTrip(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBookTrip}
              disabled={bookingLoading}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {bookingLoading ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Trips;
