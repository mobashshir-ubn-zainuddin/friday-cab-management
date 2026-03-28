import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tripApi, bookingApi } from '@/services/api';
import type { Trip } from '@/types';
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
  MapPin,
  Users,
  Car,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Phone,
  User,
  Ticket
} from 'lucide-react';

const TripDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPendingPayments } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTrip();
    }
  }, [id]);

  const fetchTrip = async () => {
    try {
      const data = await tripApi.getById(id!);
      setTrip(data as Trip);
    } catch (error) {
      console.error('Error fetching trip:', error);
      toast.error('Failed to load trip details');
    } finally {
      setLoading(false);
    }
  };

  const handleBookTrip = async () => {
    if (!trip) return;

    setBookingLoading(true);
    try {
      await bookingApi.create(trip.id);
      toast.success('Trip booked successfully!');
      fetchTrip();
      setBookingDialogOpen(false);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to book trip';
      toast.error(message);
    } finally {
      setBookingLoading(false);
    }
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

  const isBookingOpen = (trip: Trip) => {
    const now = new Date();
    return (
      trip.status === 'BOOKING_OPEN' &&
      now >= new Date(trip.bookingStartTime) &&
      now <= new Date(trip.bookingEndTime)
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <Skeleton className="h-96 bg-slate-800" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-white">Trip not found</h2>
        <Button asChild className="mt-4">
          <Link to="/trips">Back to Trips</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/trips')}
        className="text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Trips
      </Button>

      {/* Trip Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{trip.title}</h1>
          <p className="text-slate-400 mt-1">{trip.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {trip.userBooking ? (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Already Booked</span>
            </div>
          ) : (
            <Button
              onClick={() => setBookingDialogOpen(true)}
              disabled={!isBookingOpen(trip) || hasPendingPayments}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500"
            >
              <Ticket className="w-4 h-4 mr-2" />
              {isBookingOpen(trip) ? 'Book Now' : 'Booking Closed'}
            </Button>
          )}
        </div>
      </div>

      {/* Pending Payment Warning */}
      {hasPendingPayments && !trip.userBooking && (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trip Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Trip Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-400">Date</p>
                    <p className="text-white font-medium">{formatDate(trip.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-400">Departure Time</p>
                    <p className="text-white font-medium">{formatTime(trip.departureTime)}</p>
                  </div>
                </div>
                {trip.returnTime && (
                  <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-400">Return Time</p>
                      <p className="text-white font-medium">{formatTime(trip.returnTime)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg">
                  <Users className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-400">Bookings</p>
                    <p className="text-white font-medium">
                      {trip.currentBookings} / {trip.maxBookings}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <h4 className="text-sm font-medium text-white mb-3">Booking Window</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Opens</p>
                    <p className="text-white">{formatTime(trip.bookingStartTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Closes</p>
                    <p className="text-white">{formatTime(trip.bookingEndTime)}</p>
                  </div>
                </div>
              </div>

              {trip.cancellationDeadline && (
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <p className="text-sm">
                      Cancellation deadline: {formatTime(trip.cancellationDeadline)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cab Details */}
          {trip.cabs && trip.cabs.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Car className="w-5 h-5 text-emerald-400" />
                  Vehicle Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {trip.cabs.map((cab) => (
                    <div key={cab.id} className="p-4 bg-slate-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                            <Car className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {cab.vehicleType} - {cab.vehicleNumber}
                            </p>
                            <p className="text-slate-400 text-sm">
                              Capacity: {cab.currentOccupancy} / {cab.maxCapacity}
                            </p>
                          </div>
                        </div>
                      </div>
                      {(cab.driverName || cab.driverPhone) && (
                        <div className="mt-3 pt-3 border-t border-slate-700 grid sm:grid-cols-2 gap-2">
                          {cab.driverName && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-300">{cab.driverName}</span>
                            </div>
                          )}
                          {cab.driverPhone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-300">{cab.driverPhone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Trip Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge 
                variant="outline" 
                className={`
                  ${trip.status === 'BOOKING_OPEN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : ''}
                  ${trip.status === 'BOOKING_CLOSED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : ''}
                  ${trip.status === 'COMPLETED' ? 'bg-slate-500/10 text-slate-400 border-slate-500/30' : ''}
                `}
              >
                {trip.status.replace('_', ' ')}
              </Badge>

              {trip.costPerPerson && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-sm text-slate-400">Cost per person</p>
                  <p className="text-2xl font-bold text-white">₹{trip.costPerPerson}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Your Booking */}
          {trip.userBooking && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Your Booking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Confirmed</span>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Booking ID: {trip.userBooking.id.slice(0, 8)}
                </p>
                <Button asChild variant="outline" className="w-full mt-4 border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Link to="/my-bookings">View All Bookings</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Booking Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to book this trip?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <h4 className="font-medium text-white">{trip.title}</h4>
            <p className="text-slate-400 text-sm mt-1">
              {formatDate(trip.date)} at {formatTime(trip.departureTime)}
            </p>
            <div className="mt-4 p-4 bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-300">
                <strong>Note:</strong> Payment will be collected after the trip is completed. 
                The cost will be divided equally among all participants.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBookingDialogOpen(false)}
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

export default TripDetails;
